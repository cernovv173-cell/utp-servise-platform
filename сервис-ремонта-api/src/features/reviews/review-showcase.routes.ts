import express, { type Request, Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { validateImage } from "../../lib/storage/project-images.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";

const imageBody = express.raw({ type: "image/*", limit: "5mb" });
const reviewImageParams = z.object({
  reviewId: z.string().uuid(),
  kind: z.enum(["client", "work"]),
});

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const readImage = (request: Request) => {
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  const contentType = validateImage(
    bytes,
    request.header("content-type") ?? "",
  );
  return { bytes, contentType };
};

const notFound = (): never => {
  throw new HttpError(
    404,
    "REVIEW_NOT_FOUND",
    "Опубликованный отзыв не найден.",
  );
};

export const createReviewShowcaseRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get("/public/reviews", async (_request, response) => {
    const reviews = await database.review.findMany({
      where: { isPublished: true, order: { status: "COMPLETED" } },
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        clientPhotoObjectId: true,
        clientPhotoConsentAt: true,
        workPhotoObjectId: true,
        customer: { select: { displayName: true } },
        order: { select: { deviceType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    response.json({
      reviews: reviews.map(
        ({
          clientPhotoObjectId,
          clientPhotoConsentAt,
          workPhotoObjectId,
          ...review
        }) => ({
          ...review,
          hasClientPhoto: Boolean(clientPhotoObjectId && clientPhotoConsentAt),
          hasWorkPhoto: Boolean(workPhotoObjectId),
        }),
      ),
    });
  });

  router.get(
    "/public/reviews/:reviewId/image/:kind",
    validateRequest({ params: reviewImageParams }),
    async (_request, response) => {
      const { reviewId, kind } =
        paramsOf<z.infer<typeof reviewImageParams>>(response);
      const review = await database.review.findFirst({
        where: {
          id: reviewId,
          isPublished: true,
          order: { status: "COMPLETED" },
        },
        select: {
          clientPhotoObjectId: true,
          clientPhotoConsentAt: true,
          workPhotoObjectId: true,
        },
      });
      if (!review) return notFound();

      const objectId =
        kind === "client"
          ? review.clientPhotoConsentAt
            ? review.clientPhotoObjectId
            : null
          : review.workPhotoObjectId;
      if (!objectId) return notFound();

      const image = await storage.download(objectId);
      response
        .setHeader("Cache-Control", "private, no-store")
        .type(image.contentType)
        .send(image.bytes);
    },
  );

  router.post(
    "/admin/reviews/:reviewId/showcase-image/:kind",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: reviewImageParams }),
    imageBody,
    async (request, response) => {
      const { reviewId, kind } =
        paramsOf<z.infer<typeof reviewImageParams>>(response);
      if (kind === "client" && request.query.clientPhotoConsent !== "true") {
        throw new HttpError(
          400,
          "CLIENT_PHOTO_CONSENT_REQUIRED",
          "Подтвердите согласие клиента на публикацию его фотографии.",
        );
      }

      const review = await database.review.findFirst({
        where: { id: reviewId, order: { status: "COMPLETED" } },
        select: {
          id: true,
          clientPhotoObjectId: true,
          workPhotoObjectId: true,
        },
      });
      if (!review) {
        throw new HttpError(
          409,
          "REVIEW_REQUIRES_COMPLETED_REPAIR",
          "Фото можно добавить только к отзыву о завершённом ремонте.",
        );
      }

      const image = readImage(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      try {
        const previousObjectId =
          kind === "client"
            ? review.clientPhotoObjectId
            : review.workPhotoObjectId;
        const updated = await database.review.update({
          where: { id: review.id },
          data:
            kind === "client"
              ? {
                  clientPhotoObjectId: objectId,
                  clientPhotoConsentAt: new Date(),
                }
              : { workPhotoObjectId: objectId },
        });
        if (previousObjectId) {
          await storage.delete(previousObjectId).catch(() => undefined);
        }
        response.json({ review: updated });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.delete(
    "/admin/reviews/:reviewId/showcase-image/:kind",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: reviewImageParams }),
    async (_request, response) => {
      const { reviewId, kind } =
        paramsOf<z.infer<typeof reviewImageParams>>(response);
      const review = await database.review.findUnique({
        where: { id: reviewId },
        select: {
          id: true,
          clientPhotoObjectId: true,
          workPhotoObjectId: true,
        },
      });
      if (!review) {
        throw new HttpError(404, "REVIEW_NOT_FOUND", "Отзыв не найден.");
      }

      const objectId =
        kind === "client"
          ? review.clientPhotoObjectId
          : review.workPhotoObjectId;
      const updated = await database.review.update({
        where: { id: review.id },
        data:
          kind === "client"
            ? { clientPhotoObjectId: null, clientPhotoConsentAt: null }
            : { workPhotoObjectId: null },
      });
      if (objectId) await storage.delete(objectId).catch(() => undefined);
      response.json({ review: updated });
    },
  );

  return router;
};
