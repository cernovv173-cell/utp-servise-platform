import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";

const articleIdParams = z.object({ articleId: z.string().uuid() });
const scheduleFields = {
  startsAt: z.string().datetime({ offset: true }).nullable().optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  isFeatured: z.boolean().optional(),
};
const createArticleBody = z
  .object({
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(5).max(8000),
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

export const createNewsRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/news",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const now = new Date();
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
      response.json({ articles, reviews });
    },
  );

  router.post(
    "/news",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: createArticleBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createArticleBody>>(response);
      const isPublished = input.isPublished ?? false;
      const startsAt = input.startsAt ? new Date(input.startsAt) : null;
      const article = await database.newsArticle.create({
        data: {
          title: input.title,
          content: input.content,
          isPublished,
          startsAt,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isFeatured: input.isFeatured ?? false,
          publishedAt: isPublished ? (startsAt ?? new Date()) : null,
          createdById: user.id,
        },
      });
      response.status(201).json({ article });
    },
  );

  router.patch(
    "/news/:articleId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: articleIdParams, body: updateArticleBody }),
    async (_request, response) => {
      const { articleId } = paramsOf<z.infer<typeof articleIdParams>>(response);
      const input = bodyOf<z.infer<typeof updateArticleBody>>(response);
      const current = await database.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, isPublished: true, startsAt: true, endsAt: true },
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
      const article = await database.newsArticle.update({
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
      response.json({ article });
    },
  );

  return router;
};
