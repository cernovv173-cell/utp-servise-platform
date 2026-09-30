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
const createArticleBody = z
  .object({
    title: z.string().trim().min(3).max(160),
    content: z.string().trim().min(5).max(8000),
    isPublished: z.boolean().optional(),
  })
  .strict();
const updateArticleBody = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    content: z.string().trim().min(5).max(8000).optional(),
    isPublished: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);

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
      const articles = await database.newsArticle.findMany({
        where: user.role === "ADMIN" ? {} : { isPublished: true },
        orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
      });
      response.json({ articles });
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
      const article = await database.newsArticle.create({
        data: {
          title: input.title,
          content: input.content,
          isPublished,
          publishedAt: isPublished ? new Date() : null,
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
        select: { id: true, isPublished: true },
      });
      if (!current)
        throw new HttpError(
          404,
          "NEWS_ARTICLE_NOT_FOUND",
          "Новость не найдена.",
        );

      const publishedAt =
        input.isPublished === undefined
          ? undefined
          : input.isPublished
            ? current.isPublished
              ? undefined
              : new Date()
            : null;
      const article = await database.newsArticle.update({
        where: { id: articleId },
        data: { ...input, publishedAt },
      });
      response.json({ article });
    },
  );

  return router;
};
