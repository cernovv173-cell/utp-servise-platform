import express, { type Request, type RequestHandler, Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { validateImage } from "../../lib/storage/project-images.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import { type MediaStorage, projectMediaStorage } from "./media-storage.js";

const imageBody: RequestHandler = express.raw({
  type: "image/*",
  limit: "5mb",
});

const itemParams = z.object({ itemId: z.string().uuid() });
const imageParams = itemParams.extend({
  objectId: z.string().trim().min(1).max(255),
});

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const imageOf = (request: Request) => {
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  return {
    bytes,
    contentType: validateImage(bytes, request.header("content-type") ?? ""),
  };
};

const imageIdsOf = (item: {
  imageObjectId: string | null;
  imageObjectIds: string[];
}) =>
  Array.from(
    new Set(
      item.imageObjectIds.length > 0
        ? item.imageObjectIds
        : item.imageObjectId
          ? [item.imageObjectId]
          : [],
    ),
  );

export const createCraftItemImagesRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.post(
    "/craft-items/:itemId/images",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: itemParams }),
    imageBody,
    async (request, response) => {
      const { itemId } = paramsOf<z.infer<typeof itemParams>>(response);
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);

      try {
        const item = await database.$transaction(async (transaction) => {
          await transaction.$queryRaw`
            SELECT "id" FROM "craft_items" WHERE "id" = ${itemId}::uuid FOR UPDATE
          `;
          const current = await transaction.craftItem.findUnique({
            where: { id: itemId },
            select: {
              id: true,
              imageObjectId: true,
              imageObjectIds: true,
            },
          });
          if (!current) {
            throw new HttpError(
              404,
              "CRAFT_ITEM_NOT_FOUND",
              "Изделие не найдено.",
            );
          }

          const imageObjectIds = imageIdsOf(current);
          if (imageObjectIds.length >= 3) {
            throw new HttpError(
              409,
              "CRAFT_ITEM_IMAGE_LIMIT",
              "Для изделия можно добавить не более трёх фотографий.",
            );
          }

          return transaction.craftItem.update({
            where: { id: itemId },
            data: {
              imageObjectIds: [...imageObjectIds, objectId],
              imageObjectId: imageObjectIds[0] ?? objectId,
            },
          });
        });
        response.status(201).json({ item });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.delete(
    "/craft-items/:itemId/images/:objectId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: imageParams }),
    async (_request, response) => {
      const { itemId, objectId } =
        paramsOf<z.infer<typeof imageParams>>(response);
      const item = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "craft_items" WHERE "id" = ${itemId}::uuid FOR UPDATE
        `;
        const current = await transaction.craftItem.findUnique({
          where: { id: itemId },
          select: { id: true, imageObjectId: true, imageObjectIds: true },
        });
        if (!current) {
          throw new HttpError(
            404,
            "CRAFT_ITEM_NOT_FOUND",
            "Изделие не найдено.",
          );
        }

        const currentImageIds = imageIdsOf(current);
        if (!currentImageIds.includes(objectId)) {
          throw new HttpError(
            404,
            "CRAFT_ITEM_IMAGE_NOT_FOUND",
            "Фотография изделия не найдена.",
          );
        }

        const imageObjectIds = currentImageIds.filter(
          (imageId) => imageId !== objectId,
        );
        return transaction.craftItem.update({
          where: { id: itemId },
          data: {
            imageObjectIds,
            imageObjectId: imageObjectIds[0] ?? null,
          },
        });
      });

      await storage.delete(objectId).catch(() => undefined);
      response.json({ item });
    },
  );

  return router;
};
