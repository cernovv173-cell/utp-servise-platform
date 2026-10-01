import express, { type Request, type RequestHandler, Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  deleteProjectImage,
  downloadProjectImage,
  uploadProjectImage,
  validateImage,
} from "../../lib/storage/project-images.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  publicUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { canViewRepairOrder } from "../orders/order-policy.js";

const imageBody: RequestHandler = express.raw({
  type: "image/*",
  limit: "5mb",
});
const mediaParams = z.object({ objectId: z.string().trim().min(1).max(255) });
const newsParams = z.object({ articleId: z.string().uuid() });
const craftItemParams = z.object({ itemId: z.string().uuid() });
const bannerParams = z.object({ bannerId: z.string().uuid() });
const orderParams = z.object({ orderId: z.string().uuid() });

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const imageOf = (request: Request) => {
  const contentType = request.header("content-type") ?? "";
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  return { bytes, contentType: validateImage(bytes, contentType) };
};

const invalidMedia = (): never => {
  throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
};

export type MediaStorage = {
  readonly upload: typeof uploadProjectImage;
  readonly delete: typeof deleteProjectImage;
  readonly download: typeof downloadProjectImage;
};

const projectMediaStorage: MediaStorage = {
  upload: uploadProjectImage,
  delete: deleteProjectImage,
  download: downloadProjectImage,
};

export const createMediaRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const allowedRoles = requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN");

  router.post(
    "/media/avatar",
    requireAuth,
    allowedRoles,
    imageBody,
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const updated = await database.user.update({
          where: { id: user.id },
          data: { avatarObjectId: objectId },
        });
        if (user.avatarObjectId && user.avatarObjectId !== objectId) {
          await storage.delete(user.avatarObjectId).catch(() => undefined);
        }
        response.json({ user: publicUser(updated) });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/news/:articleId/image",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: newsParams }),
    imageBody,
    async (request, response) => {
      const { articleId } = paramsOf<z.infer<typeof newsParams>>(response);
      const article = await database.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, imageObjectId: true },
      });
      if (!article)
        throw new HttpError(
          404,
          "NEWS_ARTICLE_NOT_FOUND",
          "Новость не найдена.",
        );
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const updated = await database.newsArticle.update({
          where: { id: articleId },
          data: { imageObjectId: objectId },
        });
        if (article.imageObjectId) {
          await storage.delete(article.imageObjectId).catch(() => undefined);
        }
        response.json({ article: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/craft-items/:itemId/image",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: craftItemParams }),
    imageBody,
    async (request, response) => {
      const { itemId } = paramsOf<z.infer<typeof craftItemParams>>(response);
      const item = await database.craftItem.findUnique({
        where: { id: itemId },
        select: { id: true, imageObjectId: true },
      });
      if (!item)
        throw new HttpError(404, "CRAFT_ITEM_NOT_FOUND", "Изделие не найдено.");
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const updated = await database.craftItem.update({
          where: { id: itemId },
          data: { imageObjectId: objectId },
        });
        if (item.imageObjectId)
          await storage.delete(item.imageObjectId).catch(() => undefined);
        response.json({ item: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/banners/:bannerId/image",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: bannerParams }),
    imageBody,
    async (request, response) => {
      const { bannerId } = paramsOf<z.infer<typeof bannerParams>>(response);
      const banner = await database.siteBanner.findUnique({
        where: { id: bannerId },
        select: { id: true, imageObjectId: true },
      });
      if (!banner)
        throw new HttpError(404, "BANNER_NOT_FOUND", "Баннер не найден.");
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const updated = await database.siteBanner.update({
          where: { id: bannerId },
          data: { imageObjectId: objectId },
        });
        if (banner.imageObjectId)
          await storage.delete(banner.imageObjectId).catch(() => undefined);
        response.json({ banner: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/orders/:orderId/photos",
    requireAuth,
    allowedRoles,
    validateRequest({ params: orderParams }),
    imageBody,
    async (request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        select: { id: true, customerId: true, assignedTechnicianId: true },
      });
      if (!order || !canViewRepairOrder(user.role, user.id, order))
        invalidMedia();
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const photo = await database.repairOrderPhoto.create({
          data: { orderId, objectId, createdById: user.id },
        });
        response.status(201).json({ photo });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.get(
    "/media/:objectId",
    requireAuth,
    allowedRoles,
    validateRequest({ params: mediaParams }),
    async (_request, response) => {
      const { objectId } = paramsOf<z.infer<typeof mediaParams>>(response);
      const user = getAuthenticatedUser(response);
      const avatarOwner = await database.user.findFirst({
        where: { avatarObjectId: objectId },
        select: { id: true, role: true },
      });

      if (avatarOwner) {
        let mayView = user.role === "ADMIN" || user.id === avatarOwner.id;
        if (
          !mayView &&
          user.role === "CUSTOMER" &&
          avatarOwner.role === "TECHNICIAN"
        ) {
          mayView = Boolean(
            await database.repairOrder.findFirst({
              where: {
                customerId: user.id,
                assignedTechnicianId: avatarOwner.id,
              },
              select: { id: true },
            }),
          );
        }
        if (
          !mayView &&
          user.role === "TECHNICIAN" &&
          avatarOwner.role === "CUSTOMER"
        ) {
          mayView = Boolean(
            await database.repairOrder.findFirst({
              where: {
                customerId: avatarOwner.id,
                assignedTechnicianId: user.id,
              },
              select: { id: true },
            }),
          );
        }
        if (!mayView) invalidMedia();
      } else {
        const now = new Date();
        const article = await database.newsArticle.findFirst({
          where: {
            imageObjectId: objectId,
            ...(user.role === "ADMIN"
              ? {}
              : {
                  isPublished: true,
                  AND: [
                    { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                    { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                  ],
                }),
          },
          select: { id: true },
        });
        if (!article) {
          const craftItem = await database.craftItem.findFirst({
            where: {
              imageObjectId: objectId,
              ...(user.role === "ADMIN" ? {} : { isPublished: true }),
            },
            select: { id: true },
          });
          if (!craftItem) {
            const banner = await database.siteBanner.findFirst({
              where: {
                imageObjectId: objectId,
                ...(user.role === "ADMIN"
                  ? {}
                  : {
                      isActive: true,
                      AND: [
                        {
                          OR: [{ startsAt: null }, { startsAt: { lte: now } }],
                        },
                        { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                      ],
                    }),
              },
              select: { id: true },
            });
            if (!banner) {
              const photo = await database.repairOrderPhoto.findUnique({
                where: { objectId },
                select: {
                  order: {
                    select: { customerId: true, assignedTechnicianId: true },
                  },
                },
              });
              if (
                !photo ||
                !canViewRepairOrder(user.role, user.id, photo.order)
              )
                invalidMedia();
            }
          }
        }
      }

      const image = await storage.download(objectId);
      response
        .setHeader("Content-Type", image.contentType)
        .setHeader("Cache-Control", "private, max-age=300")
        .setHeader("X-Content-Type-Options", "nosniff")
        .send(image.bytes);
    },
  );

  return router;
};
