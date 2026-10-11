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
  getMaxBotProfile,
  hasMaxBotToken,
  hasMaxWebhookSecret,
  isMaxWebhookSecretValid,
  sendMaxMessage,
} from "./max-bot.js";

const LINK_TOKEN_TTL_MILLISECONDS = 10 * 60 * 1_000;
const hashToken = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

const idValueSchema = z.union([
  z.number().int().positive(),
  z.string().regex(/^[1-9]\d{0,63}$/u),
]);

const updateSchema = z
  .object({
    update_type: z.string().optional(),
    payload: z.string().nullable().optional(),
    chat_id: idValueSchema.optional(),
    user: z
      .object({ user_id: idValueSchema.optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

const normalizeMaxId = (value: string | number | undefined): string | null => {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value > 0 ? String(value) : null;
  }
  if (typeof value === "string" && /^[1-9]\d{0,63}$/u.test(value)) {
    return value;
  }
  return null;
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createMaxRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/auth/max/status",
    requireAuth,
    requireRoles("CUSTOMER"),
    (_request, response) => {
      response.json({
        available:
          hasMaxBotToken() &&
          hasMaxWebhookSecret() &&
          Boolean(process.env.MAX_WEBHOOK_URL?.trim()),
        connected: Boolean(getAuthenticatedUser(response).maxUserId),
      });
    },
  );

  router.post(
    "/auth/max/link",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      let bot: Awaited<ReturnType<typeof getMaxBotProfile>>;
      try {
        bot = await getMaxBotProfile();
      } catch {
        throw new HttpError(
          503,
          "MAX_UNAVAILABLE",
          "Подключение MAX временно недоступно. Попробуйте позже.",
        );
      }

      const token = randomBytes(32).toString("base64url");
      const now = new Date();
      const expiresAt = new Date(now.getTime() + LINK_TOKEN_TTL_MILLISECONDS);
      await database.$transaction(async (transaction) => {
        await transaction.maxLinkToken.updateMany({
          where: { userId: user.id, usedAt: null, expiresAt: { gt: now } },
          data: { expiresAt: now },
        });
        await transaction.maxLinkToken.deleteMany({
          where: {
            userId: user.id,
            expiresAt: { lt: new Date(now.getTime() - 24 * 60 * 60 * 1_000) },
          },
        });
        await transaction.maxLinkToken.create({
          data: { tokenHash: hashToken(token), userId: user.id, expiresAt },
        });
      });

      response.json({
        url: `https://max.ru/${bot.username}?start=${token}`,
        expiresAt: expiresAt.toISOString(),
      });
    },
  );

  router.delete(
    "/auth/max/link",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const now = new Date();
      await database.$transaction([
        database.user.update({
          where: { id: user.id },
          data: { maxUserId: null },
        }),
        database.maxLinkToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: now },
        }),
      ]);
      response.status(204).end();
    },
  );

  router.post("/max/webhook", async (request, response) => {
    if (!isMaxWebhookSecretValid(request.header("x-max-bot-api-secret"))) {
      response.sendStatus(401);
      return;
    }

    const parsed = updateSchema.safeParse(request.body);
    if (!parsed.success) {
      response.sendStatus(200);
      return;
    }
    const update = parsed.data;
    const userId = normalizeMaxId(update.user?.user_id ?? update.chat_id);
    if (!userId) {
      response.sendStatus(200);
      return;
    }

    if (update.update_type === "bot_stopped") {
      await database.user.updateMany({
        where: { maxUserId: userId },
        data: { maxUserId: null },
      });
      response.sendStatus(200);
      return;
    }

    if (
      update.update_type !== "bot_started" ||
      !update.payload ||
      !/^[A-Za-z0-9_-]{16,64}$/u.test(update.payload)
    ) {
      response.sendStatus(200);
      return;
    }

    const now = new Date();
    try {
      const linked = await database.$transaction(async (transaction) => {
        const candidates = await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id"
          FROM "max_link_tokens"
          WHERE "token_hash" = ${hashToken(update.payload!)}
            AND "used_at" IS NULL
            AND "expires_at" > ${now}
          FOR UPDATE
        `;
        const linkToken = candidates[0];
        if (!linkToken) return false;

        const activeOwner = await transaction.user.findUnique({
          where: { maxUserId: userId },
          select: { id: true },
        });
        const storedToken = await transaction.maxLinkToken.findUnique({
          where: { id: linkToken.id },
          select: { userId: true },
        });
        if (
          !storedToken ||
          (activeOwner && activeOwner.id !== storedToken.userId)
        ) {
          return false;
        }

        const consumed = await transaction.maxLinkToken.updateMany({
          where: { id: linkToken.id, usedAt: null, expiresAt: { gt: now } },
          data: { usedAt: now },
        });
        if (consumed.count !== 1) return false;

        await transaction.maxLinkToken.updateMany({
          where: {
            userId: storedToken.userId,
            id: { not: linkToken.id },
            usedAt: null,
          },
          data: { usedAt: now },
        });
        await transaction.user.update({
          where: { id: storedToken.userId },
          data: { maxUserId: userId },
        });
        return true;
      });

      if (linked) {
        await sendMaxMessage(
          userId,
          "MAX подключён. Вы будете получать сообщения о ходе ремонта. Отключить их можно в профиле сервиса.",
        ).catch(() => undefined);
      }
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      await sendMaxMessage(
        userId,
        "Этот MAX уже связан с другим аккаунтом сервиса. Отключите его в том аккаунте или обратитесь в поддержку.",
      ).catch(() => undefined);
    }

    response.sendStatus(200);
  });

  return router;
};
