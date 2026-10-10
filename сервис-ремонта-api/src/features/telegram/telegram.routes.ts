import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import {
  getTelegramBotProfile,
  isTelegramWebhookSecretValid,
  sendTelegramMessage,
} from "./telegram-bot.js";

const LINK_TOKEN_TTL_MILLISECONDS = 10 * 60 * 1_000;
const hashToken = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const updateSchema = z
  .object({
    message: z
      .object({
        text: z.string().optional(),
        chat: z
          .object({
            id: z.union([z.number().int(), z.string().regex(/^-?\d+$/u)]),
            type: z.string(),
          })
          .passthrough(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createTelegramRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/auth/telegram/status",
    requireAuth,
    requireRoles("CUSTOMER"),
    (_request, response) => {
      response.json({
        connected: Boolean(getAuthenticatedUser(response).telegramChatId),
      });
    },
  );

  router.post(
    "/auth/telegram/link",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      let bot: Awaited<ReturnType<typeof getTelegramBotProfile>>;
      try {
        bot = await getTelegramBotProfile();
      } catch {
        throw new HttpError(
          503,
          "TELEGRAM_UNAVAILABLE",
          "Подключение Telegram временно недоступно. Попробуйте позже.",
        );
      }

      const token = randomBytes(32).toString("base64url");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MILLISECONDS);
      await database.$transaction(async (transaction) => {
        await transaction.telegramLinkToken.updateMany({
          where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
          data: { expiresAt: now },
        });
        await transaction.telegramLinkToken.deleteMany({
          where: {
            userId: user.id,
            expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1_000) },
          },
        });
        await transaction.telegramLinkToken.create({
          data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
        });
      });

      response.json({
        url: `https://t.me/${bot.username}?start=${token}`,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );

  router.delete(
    "/auth/telegram/link",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const now = new Date();
      await database.$transaction([
        database.user.update({
          where: { id: user.id },
          data: { telegramChatId: null },
        }),
        database.telegramLinkToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: now },
        }),
      ]);
      response.status(204).end();
    },
  );

  router.post("/telegram/webhook", async (request, response) => {
    if (
      !isTelegramWebhookSecretValid(
        request.header("x-telegram-bot-api-secret-token"),
      )
    ) {
      response.sendStatus(401);
      return;
    }

    const parsed = updateSchema.safeParse(request.body);
    const message = parsed.success ? parsed.data.message : undefined;
    if (!message || message.chat.type !== "private" || !message.text) {
      response.sendStatus(200);
      return;
    }

    const token = message.text.match(
      /^\/start(?:@[A-Za-z0-9_]+)?\s+([A-Za-z0-9_-]{16,64})(?:\s|$)/u,
    )?.[1];
    if (!token) {
      response.sendStatus(200);
      return;
    }

    const rawChatId = message.chat.id;
    if (typeof rawChatId === "number" && !Number.isSafeInteger(rawChatId)) {
      response.sendStatus(200);
      return;
    }
    const chatId = String(rawChatId);
    if (!/^\d{1,64}$/u.test(chatId)) {
      response.sendStatus(200);
      return;
    }

    const now = new Date();
    try {
      const linked = await database.$transaction(async (transaction) => {
        const candidates = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "telegram_link_tokens"
          WHERE "token_hash" = ${hashToken(token)}
            AND "used_at" IS NULL
            AND "expires_at" > ${now}
          FOR UPDATE
        `;
        const linkToken = candidates[0];
        if (!linkToken) return false;

        const activeOwner = await transaction.user.findUnique({
          where: { telegramChatId: chatId },
          select: { id: true },
        });
        const storedToken = await transaction.telegramLinkToken.findUnique({
          where: { id: linkToken.id },
          select: { userId: true },
        });
        if (
          !storedToken ||
          (activeOwner && activeOwner.id !== storedToken.userId)
        ) {
          return false;
        }

        const consumed = await transaction.telegramLinkToken.updateMany({
          where: { id: linkToken.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) return false;

        await transaction.telegramLinkToken.updateMany({
          where: {
            userId: storedToken.userId,
            id: { not: linkToken.id },
            usedAt: null,
          },
          data: { usedAt: now },
        });
        await transaction.user.update({
          where: { id: storedToken.userId },
          data: { telegramChatId: chatId },
        });
        return true;
      });

      if (linked) {
        await sendTelegramMessage(
          chatId,
          "Telegram подключён. Вы будете получать сообщения о ходе ремонта. Отключить их можно в профиле сервиса.",
        ).catch(() => undefined);
      }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await sendTelegramMessage(
        chatId,
        "Этот Telegram уже связан с другим аккаунтом сервиса. Отключите его в том аккаунте или обратитесь в поддержку.",
      ).catch(() => undefined);
    }

    response.sendStatus(200);
  });

  return router;
};
