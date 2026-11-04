import { Router } from "express";
import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { sendMaxMessage } from "../max/max-bot.js";
import {
  type PasswordResetEmailSender,
  createPasswordResetEmailSender,
} from "./password-reset-mailer.js";
import { hashPassword } from "./passwords.js";

const RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1_000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_MAX_KEYS = 10_000;
const RESET_CODE_MAX_ATTEMPTS = 5;
const resetRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((v) => v.toLowerCase()),
  })
  .strict();
const resetTokenConfirmSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: z.string().min(8).max(128),
  })
  .strict();
const resetCodeConfirmSchema = z
  .object({
    email: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((value) => value.toLowerCase()),
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/),
    newPassword: z.string().min(8).max(128),
  })
  .strict();
const resetConfirmSchema = z.union([
  resetTokenConfirmSchema,
  resetCodeConfirmSchema,
]);

type Options = {
  readonly sendEmail?: PasswordResetEmailSender;
  readonly onDeliveryFailure?: () => void;
  readonly onMaxDeliveryFailure?: () => void;
  readonly webAppOrigins?: string;
  readonly now?: () => number;
  readonly codeSecret?: string;
  readonly sendMaxMessage?: (userId: string, text: string) => Promise<void>;
};

type Body<T> = { readonly body: T };
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as Body<T>).body;
const hashResetToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
const hashResetCode = (secret: string, userId: string, code: string): string =>
  createHmac("sha256", secret)
    .update(`password-reset-code:v1:${userId}:${code}`)
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
    throw new Error("Password reset code signing is not configured.");
  }
  return secret;
};

const genericRequestResponse = {
  message:
    "Если аккаунт с таким адресом существует, мы отправили инструкции по восстановлению.",
};

const parseTrustedOrigins = (configured: string): string[] =>
  configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .flatMap((value) => {
      try {
        const url = new URL(value);
        if (
          !["https:", "http:"].includes(url.protocol) ||
          url.pathname !== "/" ||
          url.search ||
          url.hash
        ) {
          return [];
        }
        return [url.origin];
      } catch {
        return [];
      }
    });

const createResetUrl = (
  requestOrigin: string | undefined,
  configuredOrigins: string,
): string => {
  const origins = parseTrustedOrigins(configuredOrigins);
  const requested = requestOrigin
    ? parseTrustedOrigins(requestOrigin)[0]
    : undefined;
  const origin =
    requested && origins.includes(requested) ? requested : origins[0];
  if (!origin) throw new Error("Password reset web origin is not configured.");
  return new URL("/reset-password", origin).toString();
};

const invalidCodeError = (): HttpError =>
  new HttpError(
    400,
    "RESET_CODE_INVALID",
    "Код неверен или срок действия истёк. Запросите новый код.",
  );

export const createPasswordResetRouter = (
  database: DatabaseClient,
  options: Options = {},
): Router => {
  const router = Router();
  const now = options.now ?? Date.now;
  const sendEmail = options.sendEmail ?? createPasswordResetEmailSender();
  const sendMax = options.sendMaxMessage ?? sendMaxMessage;
  const configuredOrigins =
    options.webAppOrigins ?? process.env.WEB_APP_ORIGIN ?? "";
  const codeSecret =
    options.codeSecret ?? process.env.PASSWORD_RESET_CODE_SECRET;
  const limits = new Map<string, { startedAt: number; count: number }>();

  const getRateLimitRetryAfter = (
    email: string,
    timestamp: number,
  ): number | null => {
    const key = createHash("sha256").update(email).digest("hex");
    const current = limits.get(key);
    if (current && timestamp - current.startedAt < RATE_LIMIT_WINDOW_MS) {
      if (current.count >= RATE_LIMIT_MAX_REQUESTS) {
        return Math.max(
          1,
          Math.ceil(
            (current.startedAt + RATE_LIMIT_WINDOW_MS - timestamp) / 1_000,
          ),
        );
      }
      current.count += 1;
      return null;
    }

    if (limits.size >= RATE_LIMIT_MAX_KEYS) {
      for (const [entryKey, value] of limits) {
        if (timestamp - value.startedAt >= RATE_LIMIT_WINDOW_MS) {
          limits.delete(entryKey);
        }
      }
      if (limits.size >= RATE_LIMIT_MAX_KEYS) return 60;
    }

    limits.set(key, { startedAt: timestamp, count: 1 });
    return null;
  };

  router.post(
    "/auth/password-reset/request",
    validateRequest({ body: resetRequestSchema }),
    async (request, response, next) => {
      const timestamp = now();
      const { email } = bodyOf<z.infer<typeof resetRequestSchema>>(response);
      const retryAfter = getRateLimitRetryAfter(email, timestamp);
      if (retryAfter !== null) {
        response.setHeader("Retry-After", String(retryAfter));
        response.status(429).json({
          error: {
            code: "RESET_REQUEST_RATE_LIMITED",
            message:
              "Слишком много запросов на восстановление. Подождите и попробуйте снова.",
          },
        });
        return;
      }

      try {
        const user = await database.user.findUnique({
          where: { email },
          select: { id: true, email: true, active: true, maxUserId: true },
        });
        if (!user?.active) {
          response.status(202).json(genericRequestResponse);
          return;
        }

        const secret = getCodeSecret(codeSecret);
        const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
        const tokenHash = hashResetCode(secret, user.id, code);
        const expiresAt = new Date(timestamp + RESET_TOKEN_LIFETIME_MS);
        const resetUrl = createResetUrl(
          request.header("origin"),
          configuredOrigins,
        );
        await database.$transaction(async (transaction) => {
          await transaction.passwordResetToken.deleteMany({
            where: { userId: user.id },
          });
          await transaction.passwordResetToken.create({
            data: { userId: user.id, tokenHash, expiresAt, failedAttempts: 0 },
          });
        });

        const mailboxDomain =
          process.env.MAIL_RU_EMAIL?.split("@").pop() ?? "utp-servise.invalid";
        const messageId = `<password-reset-${tokenHash}@${mailboxDomain}>`;
        response.status(202).json(genericRequestResponse);

        const emailDelivery = user.email
          ? sendEmail({
              to: user.email,
              resetCode: code,
              resetUrl,
              messageId,
            })
          : Promise.resolve();
        const maxDelivery = user.maxUserId
          ? sendMax(
              user.maxUserId,
              `Код для восстановления пароля UTP Servise: ${code}\n\nСсылка для смены пароля: ${resetUrl}\n\nКод действует 30 минут и может быть использован один раз. Если вы не запрашивали восстановление, проигнорируйте это сообщение.`,
            )
          : Promise.resolve();

        void Promise.allSettled([emailDelivery, maxDelivery]).then(
          async ([emailResult, maxResult]) => {
            const emailFailed =
              Boolean(user.email) && emailResult.status === "rejected";
            const maxFailed = maxResult.status === "rejected";
            if (emailFailed) options.onDeliveryFailure?.();
            if (maxFailed) options.onMaxDeliveryFailure?.();
            if (
              (!user.email || emailFailed) &&
              (!user.maxUserId || maxFailed)
            ) {
              await database.passwordResetToken
                .deleteMany({ where: { tokenHash } })
                .catch(() => undefined);
            }
          },
        );
      } catch (error) {
        next(error);
      }
    },
  );

  router.post(
    "/auth/password-reset/confirm",
    validateRequest({ body: resetConfirmSchema }),
    async (_request, response, next) => {
      const body = bodyOf<z.infer<typeof resetConfirmSchema>>(response);
      const timestamp = now();
      const applyPasswordReset = async (
        reset: { id: string; userId: string; tokenHash: string },
        newPassword: string,
      ): Promise<boolean> => {
        const passwordHash = await hashPassword(newPassword);
        return database.$transaction(async (transaction) => {
          const consumed = await transaction.passwordResetToken.deleteMany({
            where: {
              id: reset.id,
              userId: reset.userId,
              tokenHash: reset.tokenHash,
              expiresAt: { gt: new Date(now()) },
              failedAttempts: { lt: RESET_CODE_MAX_ATTEMPTS },
            },
          });
          if (consumed.count !== 1) return false;
          await transaction.user.update({
            where: { id: reset.userId },
            data: { passwordHash, mustChangePassword: false },
          });
          await transaction.session.deleteMany({
            where: { userId: reset.userId },
          });
          await transaction.passwordResetToken.deleteMany({
            where: { userId: reset.userId },
          });
          return true;
        });
      };

      let changed = false;
      if ("token" in body) {
        const tokenHash = hashResetToken(body.token);
        const reset = await database.passwordResetToken.findFirst({
          where: { tokenHash, expiresAt: { gt: new Date(timestamp) } },
        });
        if (!reset) {
          next(
            new HttpError(
              400,
              "RESET_LINK_INVALID",
              "Ссылка недействительна или срок её действия истёк. Запросите новую.",
            ),
          );
          return;
        }
        changed = await applyPasswordReset(reset, body.newPassword);
      } else {
        const user = await database.user.findUnique({
          where: { email: body.email },
          select: { id: true, active: true },
        });
        if (!user?.active) {
          next(invalidCodeError());
          return;
        }

        const reset = await database.passwordResetToken.findFirst({
          where: {
            userId: user.id,
            expiresAt: { gt: new Date(timestamp) },
          },
        });
        if (!reset || reset.failedAttempts >= RESET_CODE_MAX_ATTEMPTS) {
          next(invalidCodeError());
          return;
        }

        const expectedHash = hashResetCode(
          getCodeSecret(codeSecret),
          user.id,
          body.code,
        );
        if (!hashesMatch(reset.tokenHash, expectedHash)) {
          await database.passwordResetToken.updateMany({
            where: {
              id: reset.id,
              expiresAt: { gt: new Date(now()) },
              failedAttempts: { lt: RESET_CODE_MAX_ATTEMPTS },
            },
            data: { failedAttempts: { increment: 1 } },
          });
          next(invalidCodeError());
          return;
        }

        changed = await applyPasswordReset(reset, body.newPassword);
      }

      if (!changed) {
        next(
          "token" in body
            ? new HttpError(
                400,
                "RESET_LINK_INVALID",
                "Ссылка недействительна или срок её действия истёк. Запросите новую.",
              )
            : invalidCodeError(),
        );
        return;
      }
      response.json({
        message: "Пароль изменён. Теперь войдите с новым паролем.",
      });
    },
  );

  return router;
};
