import express, { type Request, type RequestHandler, Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { validateImage } from "../../lib/storage/project-images.js";
import {
  createRequireAuth,
  requireStaffPermission,
} from "../auth/auth.middleware.js";
import { type MediaStorage, projectMediaStorage } from "./media-storage.js";

const imageBody: RequestHandler = express.raw({
  type: "image/*",
  limit: "5mb",
});

const catalogImageParams = z.object({ catalogItemId: z.string().uuid() });
const catalogImageDeleteParams = catalogImageParams.extend({
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

export const createCatalogProductImagesRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.post(
    "/catalog/:catalogItemId/images",
    requireAuth,
    requireStaffPermission("inventory"),
    validateRequest({ params: catalogImageParams }),
    imageBody,
    async (request, response) => {
      const { catalogItemId } =
        paramsOf<z.infer<typeof catalogImageParams>>(response);
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);

      try {
        const catalogItem = await database.$transaction(async (transaction) => {
          await transaction.$queryRaw`
            SELECT "id" FROM "repair_catalog_items" WHERE "id" = ${catalogItemId}::uuid FOR UPDATE
          `;
          const current = await transaction.repairCatalogItem.findUnique({
            where: { id: catalogItemId },
            select: { id: true, type: true, imageObjectIds: true },
          });
          if (!current || current.type !== "PRODUCT") {
            throw new HttpError(
              404,
              "CATALOG_PRODUCT_NOT_FOUND",
              "Товар не найден.",
            );
          }
          if (current.imageObjectIds.length >= 3) {
            throw new HttpError(
              409,
              "CATALOG_PRODUCT_IMAGE_LIMIT",
              "Для товара можно добавить не более трёх фотографий.",
            );
          }
          return transaction.repairCatalogItem.update({
            where: { id: catalogItemId },
            data: { imageObjectIds: [...current.imageObjectIds, objectId] },
          });
        });
        response.status(201).json({ catalogItem });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }
    },
  );

  router.delete(
    "/catalog/:catalogItemId/images/:objectId",
    requireAuth,
    requireStaffPermission("inventory"),
    validateRequest({ params: catalogImageDeleteParams }),
    async (_request, response) => {
      const { catalogItemId, objectId } =
        paramsOf<z.infer<typeof catalogImageDeleteParams>>(response);
      const catalogItem = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_catalog_items" WHERE "id" = ${catalogItemId}::uuid FOR UPDATE
        `;
        const current = await transaction.repairCatalogItem.findUnique({
          where: { id: catalogItemId },
          select: { id: true, type: true, imageObjectIds: true },
        });
        if (!current || current.type !== "PRODUCT") {
          throw new HttpError(
            404,
            "CATALOG_PRODUCT_NOT_FOUND",
            "Товар не найден.",
          );
        }
        if (!current.imageObjectIds.includes(objectId)) {
          throw new HttpError(
            404,
            "CATALOG_PRODUCT_IMAGE_NOT_FOUND",
            "Фотография товара не найдена.",
          );
        }
        return transaction.repairCatalogItem.update({
          where: { id: catalogItemId },
          data: {
            imageObjectIds: current.imageObjectIds.filter(
              (imageId) => imageId !== objectId,
            ),
          },
        });
      });
      await storage.delete(objectId).catch(() => undefined);
      response.json({ catalogItem });
    },
  );

  return router;
};
