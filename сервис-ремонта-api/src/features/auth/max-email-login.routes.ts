import { Router } from "express";
import {
  createHmac,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  publicUser,
} from "./auth.middleware.js";
import {
  type MaxEmailLoginEmailSender,
  createMaxEmailLoginEmailSender,
} from "./max-email-login-mailer.js";
import { hashPassword } from "./passwords.js";
import { isUniqueViolation } from "./session.js";

const CODE_TTL_MS = 10 * 60 * 1_000;
const CODE_RATE_WINDOW_MS = 15 * 60 * 1_000;
const CODE_COOLDOWN_MS = 60 * 1_000;
const MAX_REQUESTS_PER_WINDOW = 5;
const MAX_FAILED_ATTEMPTS = 5;

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const requestSchema = z.object({ email: emailSchema }).strict();
const confirmSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

type Body<T> = { readonly body: T };
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as Body<T>).body;

type Options = {
  readonly sendEmail?: MaxEmailLoginEmailSender;
  readonly now?: () => number;
  readonly codeSecret?: string;
};

const hashVerificationCode = (
  secret: string,
  userId: string,
  email: string,
  code: string,
): string =>
  createHmac("sha256", secret)
    .update(`max-email-login-verification:v1:${userId}:${email}:${code}`)
    .digest("hex");

const hashesMatch = (left: string, right: string): boolean => {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return (
    leftBytes.length === rightBytes.length &&
    leftBytes.length > 0 &&
    timingSafeEqual(leftBytes, rightBytes)
  );
};

const getCodeSecret = (secret: string | undefined): string => {
  if (!secret || Buffer.byteLength(secret, "utf8") < 32) {
    throw new Error("MAX email login verification signing is not configured.");
  }
  return secret;
};

const assertMaxCustomer = (user: {
  readonly role: string;
  readonly maxUserId?: string | null;
}): void => {
  if (user.role !== "CUSTOMER" || !user.maxUserId) {
    throw new HttpError(
      403,
      "MAX_ACCOUNT_REQUIRED",
      "Резервный вход по почте доступен клиентам, вошедшим через МАКС.",
    );
  }
};

const emailAlreadyLinked = (): HttpError =>
  new HttpError(
    409,
    "EMAIL_ALREADY_LINKED",
    "К аккаунту уже привязана электронная почта.",
  );

const emailInUse = (): HttpError =>
  new HttpError(
    409,
    "EMAIL_IN_USE",
    "Этот адрес уже используется другим аккаунтом.",
  );

const invalidCode = (): HttpError =>
  new HttpError(
    400,
    "EMAIL_VERIFICATION_CODE_INVALID",
    "Код неверен или срок его действия истёк. Запросите новый код.",
  );

export const createMaxEmailLoginRouter = (
  database: DatabaseClient,
  options: Options = {},
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const now = options.now ?? Date.now;
  const sendEmail = options.sendEmail ?? createMaxEmailLoginEmailSender();
  const codeSecret =
    options.codeSecret ?? process.env.PASSWORD_RESET_CODE_SECRET;

  router.post(
    "/auth/profile/email-login/request",
    requireAuth,
    validateRequest({ body: requestSchema }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      assertMaxCustomer(user);
      const { email } = bodyOf<z.infer<typeof requestSchema>>(response);
      const secret = getCodeSecret(codeSecret);
      const timestamp = now();
      const requestedAt = new Date(timestamp);
      const outcome = await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;

        const account = await transaction.user.findUnique({
          where: { id: user.id },
          select: {
            id: true,
            email: true,
            maxUserId: true,
            role: true,
            active: true,
          },
        });
        if (
          !account?.active ||
          account.role !== "CUSTOMER" ||
          !account.maxUserId
        ) {
          throw new HttpError(
            403,
            "MAX_ACCOUNT_REQUIRED",
            "Резервный вход по почте доступен клиентам, вошедшим через МАКС.",
          );
        }
        if (account.email) throw emailAlreadyLinked();

        const existingUser = await transaction.user.findUnique({
          where: { email },
          select: { id: true },
        });
        if (existingUser && existingUser.id !== user.id) throw emailInUse();

        const current = await transaction.maxEmailLoginVerification.findUnique({
          where: { userId: user.id },
        });
        if (current) {
          const cooldownLeft =
            current.requestedAt.getTime() + CODE_COOLDOWN_MS - timestamp;
          if (cooldownLeft > 0) {
            return {
              kind: "rate_limited" as const,
              retryAfter: Math.max(1, Math.ceil(cooldownLeft / 1_000)),
            };
          }

          const inRateWindow =
            timestamp - current.requestWindowStartedAt.getTime() <
            CODE_RATE_WINDOW_MS;
          if (inRateWindow && current.requestCount >= MAX_REQUESTS_PER_WINDOW) {
            return {
              kind: "rate_limited" as const,
              retryAfter: Math.max(
                1,
                Math.ceil(
                  (current.requestWindowStartedAt.getTime() +
                    CODE_RATE_WINDOW_MS -
                    timestamp) /
                    1_000,
                ),
              ),
            };
          }

          const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
          const inWindow =
            timestamp - current.requestWindowStartedAt.getTime() <
            CODE_RATE_WINDOW_MS;
          await transaction.maxEmailLoginVerification.update({
            where: { userId: user.id },
            data: {
              email,
              codeHash: hashVerificationCode(secret, user.id, email, code),
              expiresAt: new Date(timestamp + CODE_TTL_MS),
              failedAttempts: 0,
              requestCount: inWindow ? { increment: 1 } : 1,
              requestWindowStartedAt: inWindow
                ? current.requestWindowStartedAt
                : requestedAt,
              requestedAt,
            },
          });
          return { kind: "created" as const, code };
        }

        const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
        await transaction.maxEmailLoginVerification.create({
          data: {
            userId: user.id,
            email,
            codeHash: hashVerificationCode(secret, user.id, email, code),
            expiresAt: new Date(timestamp + CODE_TTL_MS),
            failedAttempts: 0,
            requestCount: 1,
            requestWindowStartedAt: requestedAt,
            requestedAt,
          },
        });
        return { kind: "created" as const, code };
      });

      if (outcome.kind === "rate_limited") {
        response.setHeader("Retry-After", String(outcome.retryAfter));
        response.status(429).json({
          error: {
            code: "EMAIL_VERIFICATION_RATE_LIMITED",
            message: "Запросите новый код немного позже.",
          },
        });
        return;
      }

      try {
        await sendEmail({
          to: email,
          code: outcome.code,
          messageId: `${randomUUID()}@utp-servise.local`,
        });
      } catch {
        throw new HttpError(
          503,
          "EMAIL_VERIFICATION_DELIVERY_FAILED",
          "Не удалось отправить код на почту. Попробуйте позже.",
        );
      }

      response.status(202).json({
        message: "Код подтверждения отправлен на указанную почту.",
        expiresInSeconds: CODE_TTL_MS / 1_000,
      });
    },
  );

  router.post(
    "/auth/profile/email-login/confirm",
    requireAuth,
    validateRequest({ body: confirmSchema }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      assertMaxCustomer(user);
      const input = bodyOf<z.infer<typeof confirmSchema>>(response);
      const secret = getCodeSecret(codeSecret);
      const timestamp = now();
      const pending = await database.maxEmailLoginVerification.findUnique({
        where: { userId: user.id },
      });
      const canAttempt =
        pending &&
        pending.expiresAt.getTime() > timestamp &&
        pending.failedAttempts < MAX_FAILED_ATTEMPTS;
      const expectedHash = hashVerificationCode(
        secret,
        user.id,
        input.email,
        input.code,
      );
      if (
        !canAttempt ||
        pending.email !== input.email ||
        !hashesMatch(pending.codeHash, expectedHash)
      ) {
        if (canAttempt) {
          await database.maxEmailLoginVerification.updateMany({
            where: {
              id: pending.id,
              expiresAt: { gt: new Date(timestamp) },
              failedAttempts: { lt: MAX_FAILED_ATTEMPTS },
            },
            data: { failedAttempts: { increment: 1 } },
          });
        }
        throw invalidCode();
      }

      const passwordHash = await hashPassword(input.newPassword);
      try {
        const outcome = await database.$transaction(async (transaction) => {
          await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
          const currentChallenge =
            await transaction.maxEmailLoginVerification.findUnique({
              where: { userId: user.id },
            });
          if (
            !currentChallenge ||
            currentChallenge.email !== input.email ||
            currentChallenge.expiresAt.getTime() <= now() ||
            currentChallenge.failedAttempts >= MAX_FAILED_ATTEMPTS ||
            !hashesMatch(
              currentChallenge.codeHash,
              hashVerificationCode(secret, user.id, input.email, input.code),
            )
          ) {
            return { kind: "invalid_code" as const };
          }

          const account = await transaction.user.findUnique({
            where: { id: user.id },
            select: {
              id: true,
              email: true,
              maxUserId: true,
              role: true,
              active: true,
            },
          });
          if (
            !account?.active ||
            account.role !== "CUSTOMER" ||
            !account.maxUserId
          ) {
            return { kind: "not_eligible" as const };
          }
          if (account.email) return { kind: "email_already_linked" as const };

          const existingUser = await transaction.user.findUnique({
            where: { email: input.email },
            select: { id: true },
          });
          if (existingUser && existingUser.id !== user.id) {
            return { kind: "email_in_use" as const };
          }

          const updatedCount = await transaction.user.updateMany({
            where: {
              id: user.id,
              email: null,
              maxUserId: { not: null },
              role: "CUSTOMER",
              active: true,
            },
            data: {
              email: input.email,
              passwordHash,
              mustChangePassword: false,
            },
          });
          if (updatedCount.count !== 1) {
            return { kind: "not_eligible" as const };
          }

          await transaction.passwordResetToken.deleteMany({
            where: { userId: user.id },
          });
          await transaction.maxEmailLoginVerification.deleteMany({
            where: { id: currentChallenge.id, userId: user.id },
          });
          const updatedUser = await transaction.user.findUnique({
            where: { id: user.id },
          });
          if (!updatedUser) return { kind: "not_eligible" as const };
          return { kind: "verified" as const, user: updatedUser };
        });

        if (outcome.kind === "invalid_code") throw invalidCode();
        if (outcome.kind === "not_eligible") {
          throw new HttpError(
            403,
            "MAX_ACCOUNT_REQUIRED",
            "Резервный вход доступен только для аккаунта, созданного через МАКС.",
          );
        }
        if (outcome.kind === "email_already_linked") throw emailAlreadyLinked();
        if (outcome.kind === "email_in_use") throw emailInUse();
        response.json({ user: publicUser(outcome.user) });
      } catch (error) {
        if (isUniqueViolation(error)) throw emailInUse();
        throw error;
      }
    },
  );

  return router;
};
