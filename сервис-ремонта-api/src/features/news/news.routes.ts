import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
  requireStaffPermission,
} from "../auth/auth.middleware.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import { formatBirthdayGreeting } from "../notifications/birthday-greeting.js";
import {
  getMoscowBirthdayDate,
  getMoscowBirthdayDayWindow,
} from "../notifications/birthday-time.js";
import { getNextTechnologyFact } from "./technology-facts.js";

const scheduleNewsPush = async (
  database: Pick<DatabaseClient, "newsPushDelivery">,
  articleId: string,
  startsAt: Date | null,
): Promise<void> => {
  const existing = await database.newsPushDelivery.findUnique({
    where: { articleId },
    select: { sentAt: true },
  });
  if (existing?.sentAt) return;
  const now = new Date();
  const nextAttemptAt = startsAt && startsAt > now ? startsAt : now;
  await database.newsPushDelivery.upsert({
    where: { articleId },
    create: { articleId, nextAttemptAt },
    update: {
      nextAttemptAt,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
  });
};

const articleIdParams = z.object({ articleId: z.string().uuid() });
const scheduleFields = {
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  isFeatured: z.boolean().optional(),
};
const articleKind = z.enum(["NEWS", "WORK_STORY"]);
const createArticleBody = z
  .object({
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(5).max(8000),
    kind: articleKind.optional(),
    isPublished: z.boolean().optional(),
    ...scheduleFields,
  })
  .strict()
  .refine(
    (body) =>
      !body.startsAt ||
      !body.endsAt ||
      new Date(body.startsAt) < new Date(body.endsAt),
    { message: "Дата окончания должна быть позже даты начала." },
  );
const updateArticleBody = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    content: z.string().trim().min(5).max(8000).optional(),
    isPublished: z.boolean().optional(),
    ...scheduleFields,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0)
  .refine(
    (body) =>
      !body.startsAt ||
      !body.endsAt ||
      new Date(body.startsAt) < new Date(body.endsAt),
    { message: "Дата окончания должна быть позже даты начала." },
  );

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

export const createNewsRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get("/public/technology-fact", (request, response) => {
    response.setHeader("Cache-Control", "no-store");
    const previousFactId =
      typeof request.query.previousFactId === "string"
        ? request.query.previousFactId
        : undefined;
    response.json({ technologyFact: getNextTechnologyFact(previousFactId) });
  });

  router.get(
    "/news",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "PROCUREMENT", "ADMIN"),
    async (request, response) => {
      response.setHeader("Cache-Control", "no-store");
      const user = getAuthenticatedUser(response);
      const now = new Date();
      const previousFactId =
        typeof request.query.previousFactId === "string"
          ? request.query.previousFactId
          : undefined;
      const articles = await database.newsArticle.findMany({
        where:
          user.role === "ADMIN"
            ? {}
            : {
                isPublished: true,
                AND: [
                  { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                  { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                ],
              },
        orderBy: [
          { isFeatured: "desc" },
          { publishedAt: "desc" },
          { createdAt: "desc" },
        ],
        take: 100,
      });
      const reviews = await database.review.findMany({
        where: user.role === "ADMIN" ? {} : { isPublished: true },
        include: {
          customer: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      const birthday = getMoscowBirthdayDate(now);
      const birthdayGreeting =
        user.role === "CUSTOMER" &&
        user.birthDate?.toISOString().slice(5, 10) === birthday.monthDay
          ? (() => {
              const { startsAt, endsAt } = getMoscowBirthdayDayWindow(now);
              return {
                title: "С днём рождения!",
                content: formatBirthdayGreeting(
                  user.displayName,
                  user.gender ?? null,
                ),
                startsAt: startsAt.toISOString(),
                endsAt: endsAt.toISOString(),
              };
            })()
          : null;
      response.json({
        articles,
        reviews,
        birthdayGreeting,
        technologyFact: getNextTechnologyFact(previousFactId, now),
      });
    },
  );

  router.post(
    "/news",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ body: createArticleBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createArticleBody>>(response);
      const isPublished = input.isPublished ?? false;
      const kind = input.kind ?? "NEWS";
      const startsAt = input.startsAt ? new Date(input.startsAt) : null;
      const article = await database.$transaction(async (transaction) => {
        const created = await transaction.newsArticle.create({
          data: {
            title: input.title,
            content: input.content,
            kind,
            isPublished,
            startsAt,
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            isFeatured: input.isFeatured ?? false,
            publishedAt: isPublished ? (startsAt ?? new Date()) : null,
            createdById: user.id,
          },
        });
        if (isPublished && kind === "NEWS") {
          await scheduleNewsPush(transaction, created.id, startsAt);
        }
        return created;
      });
      response.status(201).json({ article });
    },
  );

  router.patch(
    "/news/:articleId",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: articleIdParams, body: updateArticleBody }),
    async (_request, response) => {
      const { articleId } = paramsOf<z.infer<typeof articleIdParams>>(response);
      const input = bodyOf<z.infer<typeof updateArticleBody>>(response);
      const current = await database.newsArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          kind: true,
          isPublished: true,
          startsAt: true,
          endsAt: true,
        },
      });
      if (!current)
        throw new HttpError(
          404,
          "NEWS_ARTICLE_NOT_FOUND",
          "Новость не найдена.",
        );

      const startsAt =
        input.startsAt === undefined
          ? undefined
          : input.startsAt
            ? new Date(input.startsAt)
            : null;
      const endsAt =
        input.endsAt === undefined
          ? current.endsAt
          : input.endsAt
            ? new Date(input.endsAt)
            : null;
      const effectiveStartsAt =
        startsAt === undefined ? current.startsAt : startsAt;
      if (effectiveStartsAt && endsAt && effectiveStartsAt >= endsAt) {
        throw new HttpError(
          400,
          "INVALID_NEWS_SCHEDULE",
          "Дата окончания должна быть позже даты начала.",
        );
      }
      const nextPublished = input.isPublished ?? current.isPublished;
      const publishedAt =
        input.isPublished === undefined && input.startsAt === undefined
          ? undefined
          : nextPublished
            ? ((startsAt === undefined ? current.startsAt : startsAt) ??
              new Date())
            : null;
      const article = await database.$transaction(async (transaction) => {
        const updated = await transaction.newsArticle.update({
          where: { id: articleId },
          data: {
            title: input.title,
            content: input.content,
            isPublished: input.isPublished,
            startsAt,
            endsAt: input.endsAt === undefined ? undefined : endsAt,
            isFeatured: input.isFeatured,
            publishedAt,
          },
        });
        if (!current.isPublished && nextPublished && current.kind === "NEWS") {
          await scheduleNewsPush(transaction, updated.id, effectiveStartsAt);
        } else if (
          current.kind === "NEWS" &&
          current.isPublished &&
          input.startsAt !== undefined
        ) {
          const nextAttemptAt =
            effectiveStartsAt && effectiveStartsAt > new Date()
              ? effectiveStartsAt
              : new Date();
          await transaction.newsPushDelivery.updateMany({
            where: { articleId, sentAt: null },
            data: { nextAttemptAt, lockedUntil: null },
          });
        }
        if (
          current.kind === "NEWS" &&
          current.isPublished &&
          input.isPublished === false
        ) {
          await transaction.newsPushDelivery.deleteMany({
            where: { articleId, sentAt: null },
          });
        }
        return updated;
      });
      response.json({ article });
    },
  );

  router.delete(
    "/news/:articleId",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: articleIdParams }),
    async (_request, response) => {
      const { articleId } = paramsOf<z.infer<typeof articleIdParams>>(response);
      const article = await database.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, imageObjectId: true, videoObjectId: true },
      });
      if (!article) {
        throw new HttpError(
          404,
          "NEWS_ARTICLE_NOT_FOUND",
          "Новость не найдена.",
        );
      }
      await database.newsArticle.delete({ where: { id: articleId } });
      await Promise.all(
        [article.imageObjectId, article.videoObjectId]
          .filter((objectId): objectId is string => Boolean(objectId))
          .map((objectId) => storage.delete(objectId).catch(() => undefined)),
      );
      response.status(204).end();
    },
  );

  return router;
};
