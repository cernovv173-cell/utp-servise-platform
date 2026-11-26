import express, { type Request, type RequestHandler, Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  validateImage,
  validateMedia,
} from "../../lib/storage/project-images.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  publicUser,
  requireRoles,
  requireStaffPermission,
} from "../auth/auth.middleware.js";
import { canAccessCraftOrderChat } from "../crafts/craft-chat-policy.js";
import {
  sendPushNotification,
  sendRepairOrderNotification,
} from "../notifications/push-notifications.js";
import { canViewRepairOrder } from "../orders/order-policy.js";
import { createCatalogProductImagesRouter } from "./catalog-product-images.routes.js";
import { createCraftItemImagesRouter } from "./craft-item-images.routes.js";
import { type MediaStorage, projectMediaStorage } from "./media-storage.js";
import { createProtectedMediaRouter } from "./protected-media.routes.js";

const imageBody: RequestHandler = express.raw({
  type: "image/*",
  limit: "5mb",
});
const mediaBody: RequestHandler = express.raw({
  type: ["image/jpeg", "image/png", "image/webp", "video/mp4"],
  limit: "20mb",
});
const newsParams = z.object({ articleId: z.string().uuid() });
const craftItemParams = z.object({ itemId: z.string().uuid() });
const craftOrderParams = z.object({ craftOrderId: z.string().uuid() });
const bannerParams = z.object({ bannerId: z.string().uuid() });
const reviewParams = z.object({ reviewId: z.string().uuid() });
const orderParams = z.object({ orderId: z.string().uuid() });
const orderPhotoConsentParams = z.object({
  orderId: z.string().uuid(),
  photoId: z.string().uuid(),
});
const intakeMediaParams = z.object({ orderId: z.string().uuid() });

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;

const invalidMedia = (): never => {
  throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
};

const imageOf = (request: Request) => {
  const contentType = request.header("content-type") ?? "";
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  return { bytes, contentType: validateImage(bytes, contentType) };
};

const mediaOf = (request: Request) => {
  const contentType = request.header("content-type") ?? "";
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  return { bytes, contentType: validateMedia(bytes, contentType) };
};

export const createMediaRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
  notify: typeof sendPushNotification = sendPushNotification,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const allowedRoles = requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN");

  router.patch(
    "/orders/:orderId/photos/:photoId/portfolio-consent",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({
      params: orderPhotoConsentParams,
      body: z.object({ consent: z.boolean() }).strict(),
    }),
    async (_request, response) => {
      const { orderId, photoId } =
        paramsOf<z.infer<typeof orderPhotoConsentParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findFirst({
        where: {
          id: orderId,
          customerId: user.id,
          status: "COMPLETED",
          assignedTechnicianId: { not: null },
        },
        select: { id: true },
      });
      if (!order)
        throw new HttpError(
          404,
          "ORDER_NOT_FOUND",
          "Завершённая заявка не найдена.",
        );
      const { consent } = bodyOf<{ consent: boolean }>(response);
      const updated = await database.repairOrderPhoto.updateMany({
        where: { id: photoId, orderId },
        data: { portfolioConsentAt: consent ? new Date() : null },
      });
      if (!updated.count)
        throw new HttpError(404, "ORDER_PHOTO_NOT_FOUND", "Фото не найдено.");
      response.json({ consent });
    },
  );

  router.patch(
    "/orders/:orderId/photos/:photoId/portfolio-consent",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({
      params: orderPhotoConsentParams,
      body: z.object({ consent: z.boolean() }).strict(),
    }),
    async (_request, response) => {
      const { orderId, photoId } =
        paramsOf<z.infer<typeof orderPhotoConsentParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findFirst({
        where: { id: orderId, customerId: user.id, status: "COMPLETED" },
        select: { id: true },
      });
      if (!order)
        throw new HttpError(
          404,
          "ORDER_NOT_FOUND",
          "Завершённая заявка не найдена.",
        );
      const { consent } = bodyOf<{ consent: boolean }>(response);
      const photo = await database.repairOrderPhoto.updateMany({
        where: { id: photoId, orderId },
        data: { portfolioConsentAt: consent ? new Date() : null },
      });
      if (!photo.count)
        throw new HttpError(404, "ORDER_PHOTO_NOT_FOUND", "Фото не найдено.");
      response.json({ consent });
    },
  );

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
    requireStaffPermission("content"),
    validateRequest({ params: newsParams }),
    imageBody,
    async (request, response) => {
      const { articleId } = paramsOf<z.infer<typeof newsParams>>(response);
      const article = await database.newsArticle.findUnique({
        where: { id: articleId },
        select: { id: true, imageObjectId: true, videoObjectId: true },
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
          data: { imageObjectId: objectId, videoObjectId: null },
        });
        if (article.imageObjectId) {
          await storage.delete(article.imageObjectId).catch(() => undefined);
        }
        if (article.videoObjectId) {
          await storage.delete(article.videoObjectId).catch(() => undefined);
        }
        response.json({ article: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/news/:articleId/media",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: newsParams }),
    mediaBody,
    async (request, response) => {
      const { articleId } = paramsOf<z.infer<typeof newsParams>>(response);
      const article = await database.newsArticle.findUnique({
        where: { id: articleId },
        select: {
          id: true,
          kind: true,
          imageObjectId: true,
          videoObjectId: true,
        },
      });
      if (!article)
        throw new HttpError(
          404,
          "NEWS_ARTICLE_NOT_FOUND",
          "Новость не найдена.",
        );
      const media = mediaOf(request);
      const video = media.contentType.startsWith("video/");
      if (article.kind === "WORK_STORY" && video) {
        throw new HttpError(
          400,
          "WORK_STORY_IMAGE_ONLY",
          "Для примера работы можно загрузить только фотографию.",
        );
      }
      const objectId = await storage.upload(media.bytes, media.contentType);
      try {
        const updated = await database.newsArticle.update({
          where: { id: articleId },
          data: {
            imageObjectId: video ? null : objectId,
            videoObjectId: video ? objectId : null,
          },
        });
        for (const previousId of [
          article.imageObjectId,
          article.videoObjectId,
        ]) {
          if (previousId && previousId !== objectId)
            await storage.delete(previousId).catch(() => undefined);
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
    requireStaffPermission("shop_orders"),
    validateRequest({ params: craftItemParams }),
    imageBody,
    async (request, response) => {
      const { itemId } = paramsOf<z.infer<typeof craftItemParams>>(response);
      const item = await database.craftItem.findUnique({
        where: { id: itemId },
        select: { id: true, imageObjectId: true, imageObjectIds: true },
      });
      if (!item)
        throw new HttpError(404, "CRAFT_ITEM_NOT_FOUND", "Изделие не найдено.");
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const updated = await database.craftItem.update({
          where: { id: itemId },
          data: { imageObjectId: objectId, imageObjectIds: [objectId] },
        });
        const previousImages = new Set([
          ...item.imageObjectIds,
          item.imageObjectId,
        ]);
        await Promise.all(
          [...previousImages]
            .filter((previousId) => previousId && previousId !== objectId)
            .map((previousId) =>
              storage.delete(previousId!).catch(() => undefined),
            ),
        );
        response.json({ item: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/craft-orders/:craftOrderId/chat/image",
    requireAuth,
    requireRoles("CUSTOMER", "ADMIN"),
    validateRequest({ params: craftOrderParams }),
    imageBody,
    async (request, response) => {
      const { craftOrderId } =
        paramsOf<z.infer<typeof craftOrderParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.craftOrder.findUnique({
        where: { id: craftOrderId },
        select: { id: true, customerId: true },
      });
      if (!order || !canAccessCraftOrderChat(user.role, user.id, order))
        throw new HttpError(404, "CRAFT_ORDER_NOT_FOUND", "Заявка не найдена.");

      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      let message: Awaited<
        ReturnType<typeof database.craftOrderChatMessage.create>
      >;
      try {
        message = await database.craftOrderChatMessage.create({
          data: {
            craftOrderId,
            senderId: user.id,
            content: "",
            imageObjectId: objectId,
          },
          include: {
            sender: { select: { id: true, displayName: true, role: true } },
          },
        });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
      const recipientIds =
        user.role === "ADMIN"
          ? [order.customerId]
          : (
              await database.user.findMany({
                where: { role: "ADMIN", active: true },
                select: { id: true },
              })
            ).map(({ id }) => id);
      await notify(database, recipientIds, {
        title: "Фото по заявке на изделие",
        body: "Откройте заявку, чтобы посмотреть сообщение.",
        data: { type: "craft_order_chat_message", craftOrderId },
      });
      response.status(201).json({ message });
    },
  );

  router.post(
    "/banners/:bannerId/image",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: bannerParams }),
    imageBody,
    async (request, response) => {
      const { bannerId } = paramsOf<z.infer<typeof bannerParams>>(response);
      const banner = await database.siteBanner.findUnique({
        where: { id: bannerId },
        select: { id: true, imageObjectId: true, videoObjectId: true },
      });
      if (!banner)
        throw new HttpError(404, "BANNER_NOT_FOUND", "Баннер не найден.");
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const updated = await database.siteBanner.update({
          where: { id: bannerId },
          data: { imageObjectId: objectId, videoObjectId: null },
        });
        if (banner.imageObjectId)
          await storage.delete(banner.imageObjectId).catch(() => undefined);
        if (banner.videoObjectId)
          await storage.delete(banner.videoObjectId).catch(() => undefined);
        response.json({ banner: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/banners/:bannerId/media",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: bannerParams }),
    mediaBody,
    async (request, response) => {
      const { bannerId } = paramsOf<z.infer<typeof bannerParams>>(response);
      const banner = await database.siteBanner.findUnique({
        where: { id: bannerId },
        select: { id: true, imageObjectId: true, videoObjectId: true },
      });
      if (!banner)
        throw new HttpError(404, "BANNER_NOT_FOUND", "Баннер не найден.");
      const media = mediaOf(request);
      const objectId = await storage.upload(media.bytes, media.contentType);
      const video = media.contentType.startsWith("video/");
      try {
        const updated = await database.siteBanner.update({
          where: { id: bannerId },
          data: {
            imageObjectId: video ? null : objectId,
            videoObjectId: video ? objectId : null,
          },
        });
        for (const previousId of [banner.imageObjectId, banner.videoObjectId]) {
          if (previousId && previousId !== objectId)
            await storage.delete(previousId).catch(() => undefined);
        }
        response.json({ banner: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/reviews/:reviewId/image",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: reviewParams }),
    imageBody,
    async (request, response) => {
      const { reviewId } = paramsOf<z.infer<typeof reviewParams>>(response);
      const user = getAuthenticatedUser(response);
      const review = await database.review.findFirst({
        where: { id: reviewId, customerId: user.id, isPublished: false },
        select: { id: true, imageObjectId: true },
      });
      if (!review)
        throw new HttpError(
          404,
          "REVIEW_NOT_FOUND",
          "Отзыв не найден или уже опубликован.",
        );
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const updated = await database.review.update({
          where: { id: review.id },
          data: { imageObjectId: objectId },
        });
        if (review.imageObjectId)
          await storage.delete(review.imageObjectId).catch(() => undefined);
        response.json({ review: updated });
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
        select: {
          id: true,
          customerId: true,
          assignedTechnicianId: true,
          status: true,
        },
      });
      if (!order || !canViewRepairOrder(user.role, user.id, order))
        return invalidMedia();
      if (user.role === "ADMIN" && order.status !== "REQUESTED") {
        throw new HttpError(
          403,
          "ORDER_MEDIA_INTAKE_ONLY",
          "Администратор может добавлять фото только на этапе первичного приёма.",
        );
      }
      if (
        ["READY_FOR_PICKUP", "COMPLETED", "CANCELLED"].includes(order.status)
      ) {
        throw new HttpError(
          409,
          "INTAKE_LOCKED",
          "Фотографии акта нельзя изменить после завершения ремонта.",
        );
      }
      const notificationOrder = {
        id: order.id,
        customerId: order.customerId,
        assignedTechnicianId: order.assignedTechnicianId,
      };
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const photo = await database.repairOrderPhoto.create({
          data: { orderId, objectId, createdById: user.id },
        });
        await sendRepairOrderNotification(
          database,
          notificationOrder,
          user.id,
          "К заявке добавлена фотография.",
        );
        response.status(201).json({ photo });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.post(
    "/orders/:orderId/intake/media",
    requireAuth,
    requireRoles("TECHNICIAN", "ADMIN"),
    validateRequest({ params: intakeMediaParams }),
    mediaBody,
    async (request, response) => {
      const { orderId } = paramsOf<z.infer<typeof intakeMediaParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customerId: true,
          assignedTechnicianId: true,
          status: true,
        },
      });
      if (!order || !canViewRepairOrder(user.role, user.id, order))
        return invalidMedia();
      if (user.role === "ADMIN" && order.status !== "REQUESTED") {
        throw new HttpError(
          403,
          "ORDER_MEDIA_INTAKE_ONLY",
          "Администратор может прикладывать материалы только на этапе первичного приёма.",
        );
      }
      const media = mediaOf(request);
      const objectId = await storage.upload(media.bytes, media.contentType);
      try {
        const intake = await database.repairOrderIntake.upsert({
          where: { orderId },
          create: {
            orderId,
            createdById: user.id,
            updatedById: user.id,
            intakeMediaObjectId: objectId,
            intakeMediaType: media.contentType.startsWith("video/")
              ? "VIDEO"
              : "IMAGE",
          },
          update: {
            updatedById: user.id,
            intakeMediaObjectId: objectId,
            intakeMediaType: media.contentType.startsWith("video/")
              ? "VIDEO"
              : "IMAGE",
          },
        });
        response.status(201).json({ intake });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.use(createCatalogProductImagesRouter(database, storage));
  router.use(createCraftItemImagesRouter(database, storage));
  router.use(createProtectedMediaRouter(database, storage));

  return router;
};
