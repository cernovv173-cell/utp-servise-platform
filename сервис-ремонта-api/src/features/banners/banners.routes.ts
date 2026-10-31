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

const bannerParams = z.object({ bannerId: z.string().uuid() });
const date = z.string().datetime({ offset: true }).nullable().optional();
const title = z.string().trim().min(2).max(160);
const content = z.string().trim().min(1).max(1000);
const placements = z
  .array(z.enum(["HOME", "NEWS", "SERVICE", "CRAFTS", "ABOUT", "LOYALTY"]))
  .min(1)
  .max(6);
const targetUrl = z
  .string()
  .url()
  .max(1000)
  .refine(
    (value) =>
      /^https?:\/\//i.test(value) ||
      /^app:\/\/(home|news|services|crafts|about|loyalty|checks)$/i.test(value),
    "Используйте HTTP(S)-ссылку или допустимый внутренний раздел приложения.",
  )
  .nullable();
const createBody = z
  .object({
    title,
    content,
    targetUrl: targetUrl.optional(),
    placements: placements.optional(),
    startsAt: date,
    endsAt: date,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (body) =>
      !body.startsAt ||
      !body.endsAt ||
      new Date(body.startsAt) < new Date(body.endsAt),
  );
const updateBody = z
  .object({
    title: title.optional(),
    content: content.optional(),
    targetUrl: targetUrl.optional(),
    placements: placements.optional(),
    startsAt: date,
    endsAt: date,
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0)
  .refine(
    (body) =>
      !body.startsAt ||
      !body.endsAt ||
      new Date(body.startsAt) < new Date(body.endsAt),
  );
const paramsOf = (response: { locals: { input?: unknown } }) =>
  (response.locals.input as { readonly params: z.infer<typeof bannerParams> })
    .params;
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;

export const createBannersRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/banners",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const now = new Date();
      const where =
        user.role === "ADMIN"
          ? {}
          : {
              isActive: true,
              AND: [
                { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
              ],
            };
      response.json({
        banners: await database.siteBanner.findMany({
          where,
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
      });
    },
  );

  router.post(
    "/banners",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: createBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createBody>>(response);
      if (input.isActive) {
        throw new HttpError(
          409,
          "BANNER_IMAGE_REQUIRED",
          "Сначала загрузите изображение, затем включите кампанию.",
        );
      }
      const banner = await database.siteBanner.create({
        data: {
          title: input.title,
          content: input.content,
          targetUrl: input.targetUrl,
          placements: input.placements ?? ["HOME"],
          startsAt: input.startsAt ? new Date(input.startsAt) : null,
          endsAt: input.endsAt ? new Date(input.endsAt) : null,
          isActive: input.isActive ?? false,
          createdById: user.id,
        },
      });
      response.status(201).json({ banner });
    },
  );

  router.patch(
    "/banners/:bannerId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: bannerParams, body: updateBody }),
    async (_request, response) => {
      const { bannerId } = paramsOf(response);
      const input = bodyOf<z.infer<typeof updateBody>>(response);
      const current = await database.siteBanner.findUniqueOrThrow({
        where: { id: bannerId },
      });
      const startsAt =
        input.startsAt === undefined
          ? current.startsAt
          : input.startsAt
            ? new Date(input.startsAt)
            : null;
      const endsAt =
        input.endsAt === undefined
          ? current.endsAt
          : input.endsAt
            ? new Date(input.endsAt)
            : null;
      if (startsAt && endsAt && startsAt >= endsAt) {
        throw new HttpError(
          400,
          "INVALID_BANNER_SCHEDULE",
          "Дата окончания должна быть позже даты начала.",
        );
      }
      const nextTargetUrl =
        input.targetUrl === undefined ? current.targetUrl : input.targetUrl;
      const nextTitle = input.title ?? current.title;
      const nextContent = input.content ?? current.content;
      if (
        input.isActive &&
        (!current.imageObjectId ||
          !nextTargetUrl ||
          !nextTitle.trim() ||
          !nextContent.trim())
      ) {
        throw new HttpError(
          409,
          "BANNER_CONTENT_REQUIRED",
          "Для показа кампании нужны изображение, заголовок, текст и ссылка.",
        );
      }
      const banner = await database.siteBanner.update({
        where: { id: bannerId },
        data: {
          title: input.title,
          content: input.content,
          targetUrl: input.targetUrl,
          placements: input.placements,
          startsAt: input.startsAt === undefined ? undefined : startsAt,
          endsAt: input.endsAt === undefined ? undefined : endsAt,
          isActive: input.isActive,
        },
      });
      response.json({ banner });
    },
  );

  router.delete(
    "/banners/:bannerId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: bannerParams }),
    async (_request, response) => {
      const { bannerId } = paramsOf(response);
      const deleted = await database.siteBanner.deleteMany({
        where: { id: bannerId },
      });
      if (deleted.count === 0) {
        throw new HttpError(404, "BANNER_NOT_FOUND", "Баннер не найден.");
      }
      response.status(204).end();
    },
  );

  return router;
};
