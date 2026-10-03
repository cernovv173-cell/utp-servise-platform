import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  type PasswordResetEmailSender,
  createPasswordResetEmailSender,
} from "./password-reset-mailer.js";
import { hashPassword } from "./passwords.js";

const RESET_TOKEN_LIFETIME_MS = 30 * 60 * 1_000;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 5;
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
const resetConfirmSchema = z
  .object({
    token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

type Options = {
  readonly sendEmail?: PasswordResetEmailSender;
  readonly onDeliveryFailure?: () => void;
  readonly webAppOrigins?: string;
  readonly now?: () => number;
};

type Body<T> = { readonly body: T };
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as Body<T>).body;
const hashResetToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const genericRequestResponse = {
  message:
    "Если аккаунт с таким адресом существует, мы отправили письмо с инструкциями.",
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
  token: string,
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
  const url = new URL("/reset-password", origin);
  url.hash = new URLSearchParams({ token }).toString();
  return url.toString();
};

export const createPasswordResetRouter = (
  database: DatabaseClient,
  options: Options = {},
): Router => {
  const router = Router();
  const now = options.now ?? Date.now;
  const sendEmail = options.sendEmail ?? createPasswordResetEmailSender();
  const configuredOrigins =
    options.webAppOrigins ?? process.env.WEB_APP_ORIGIN ?? "";
  const limits = new Map<string, { startedAt: number; count: number }>();

  router.post(
    "/auth/password-reset/request",
    validateRequest({ body: resetRequestSchema }),
    async (request, response, next) => {
      const timestamp = now();
      const clientKey = request.ip ?? request.socket.remoteAddress ?? "unknown";
      const limit = limits.get(clientKey);
      if (limit && timestamp - limit.startedAt < RATE_LIMIT_WINDOW_MS) {
        limit.count += 1;
        if (limit.count > RATE_LIMIT_MAX_REQUESTS) {
          response.status(202).json(genericRequestResponse);
          return;
        }
      } else {
        limits.set(clientKey, { startedAt: timestamp, count: 1 });
      }
      if (limits.size > 10_000) {
        for (const [key, value] of limits) {
          if (timestamp - value.startedAt >= RATE_LIMIT_WINDOW_MS)
            limits.delete(key);
        }
      }

      const { email } = bodyOf<z.infer<typeof resetRequestSchema>>(response);
      try {
        const user = await database.user.findUnique({
          where: { email },
          select: { id: true, email: true, active: true },
        });
        if (!user?.active) {
          response.status(202).json(genericRequestResponse);
          return;
        }

        const token = randomBytes(32).toString("base64url");
        const tokenHash = hashResetToken(token);
        const expiresAt = new Date(timestamp + RESET_TOKEN_LIFETIME_MS);
        await database.$transaction(async (transaction) => {
          await transaction.passwordResetToken.deleteMany({
            where: { userId: user.id },
          });
          await transaction.passwordResetToken.create({
            data: { userId: user.id, tokenHash, expiresAt },
          });
        });

        const resetUrl = createResetUrl(
          token,
          request.header("origin"),
          configuredOrigins,
        );
        const mailboxDomain =
          process.env.YANDEX_MAIL_EMAIL?.split("@").pop() ??
          "utp-servise.invalid";
        const messageId = `<password-reset-${tokenHash}@${mailboxDomain}>`;
        response.status(202).json(genericRequestResponse);

        void sendEmail({ to: user.email, resetUrl, messageId }).catch(
          async () => {
            await database.passwordResetToken
              .deleteMany({ where: { tokenHash } })
              .catch(() => undefined);
            options.onDeliveryFailure?.();
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
      const { token, newPassword } =
        bodyOf<z.infer<typeof resetConfirmSchema>>(response);
      const tokenHash = hashResetToken(token);
      const timestamp = now();
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

      const passwordHash = await hashPassword(newPassword);
      const changed = await database.$transaction(async (transaction) => {
        const consumed = await transaction.passwordResetToken.deleteMany({
          where: {
            id: reset.id,
            tokenHash,
            expiresAt: { gt: new Date(now()) },
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

      if (!changed) {
        next(
          new HttpError(
            400,
            "RESET_LINK_INVALID",
            "Ссылка недействительна или срок её действия истёк. Запросите новую.",
          ),
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
