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
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import { isInventoryCatalogItem } from "./catalog-policy.js";

const catalogItemIdParams = z.object({
  catalogItemId: z.string().uuid(),
});
const itemType = z.enum(["SERVICE", "SPARE_PART", "PRODUCT"]);
const catalogCreateBody = z
  .object({
    type: itemType,
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().max(2000).nullable().optional(),
    unitPriceRub: z.number().int().min(0).max(10_000_000),
    stockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
    minimumStockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
  })
  .strict()
  .refine((body) => body.type === "PRODUCT" || body.description == null, {
    message: "Описание доступно только для товаров.",
    path: ["description"],
  })
  .refine(
    (body) =>
      isInventoryCatalogItem(body.type) || body.stockQuantity === undefined,
    {
      message: "Услуги не учитываются на складе.",
      path: ["stockQuantity"],
    },
  )
  .refine(
    (body) =>
      isInventoryCatalogItem(body.type) ||
      body.minimumStockQuantity === undefined,
    {
      message: "Порог остатка задаётся только для товара или запчасти.",
      path: ["minimumStockQuantity"],
    },
  );
const catalogUpdateBody = z
  .object({
    type: itemType.optional(),
    name: z.string().trim().min(2).max(160).optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    unitPriceRub: z.number().int().min(0).max(10_000_000).optional(),
    stockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
    minimumStockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0)
  .refine(
    (body) => body.type !== "SERVICE" || body.stockQuantity === undefined,
    {
      message: "Услуги не учитываются на складе.",
      path: ["stockQuantity"],
    },
  )
  .refine(
    (body) =>
      body.type !== "SERVICE" || body.minimumStockQuantity === undefined,
    {
      message: "Порог остатка задаётся только для товара или запчасти.",
      path: ["minimumStockQuantity"],
    },
  );
const inventoryUpdateBody = z
  .object({
    stockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
    minimumStockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

export const createCatalogRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/customer/service-prices",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const prices = await database.repairCatalogItem.findMany({
        where: { type: "SERVICE", active: true },
        select: { id: true, name: true, unitPriceRub: true },
        orderBy: { name: "asc" },
      });
      response.json({ prices });
    },
  );

  router.get("/public/service-prices", async (_request, response) => {
    const prices = await database.repairCatalogItem.findMany({
      where: { type: "SERVICE", active: true },
      select: { id: true, name: true, unitPriceRub: true },
      orderBy: { name: "asc" },
      take: 100,
    });
    response.json({ prices });
  });

  router.get(
    "/catalog",
    requireAuth,
    requireRoles("ADMIN", "TECHNICIAN", "PROCUREMENT"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const catalogItems = await database.repairCatalogItem.findMany({
        where:
          user.role === "PROCUREMENT"
            ? { active: true, type: { in: ["SPARE_PART", "PRODUCT"] } }
            : user.role === "TECHNICIAN"
              ? { active: true }
              : {},
        orderBy: [{ type: "asc" }, { name: "asc" }],
        take: 250,
      });
      response.json({ catalogItems });
    },
  );

  router.patch(
    "/catalog/:catalogItemId/inventory",
    requireAuth,
    requireRoles("ADMIN", "PROCUREMENT"),
    validateRequest({
      params: catalogItemIdParams,
      body: inventoryUpdateBody,
    }),
    async (_request, response) => {
      const actor = getAuthenticatedUser(response);
      const { catalogItemId } =
        paramsOf<z.infer<typeof catalogItemIdParams>>(response);
      const input = bodyOf<z.infer<typeof inventoryUpdateBody>>(response);
      const catalogItem = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_catalog_items" WHERE "id" = ${catalogItemId}::uuid FOR UPDATE
        `;
        const existing = await transaction.repairCatalogItem.findUnique({
          where: { id: catalogItemId },
          select: { id: true, type: true, active: true },
        });
        if (
          !existing ||
          !isInventoryCatalogItem(existing.type) ||
          (actor.role === "PROCUREMENT" && !existing.active)
        ) {
          throw new HttpError(
            404,
            "INVENTORY_ITEM_NOT_FOUND",
            "Активная запчасть или товар не найдены.",
          );
        }
        return transaction.repairCatalogItem.update({
          where: { id: catalogItemId },
          data: input,
        });
      });
      response.json({ catalogItem });
    },
  );

  router.post(
    "/catalog",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: catalogCreateBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof catalogCreateBody>>(response);
      const catalogItem = await database.repairCatalogItem.create({
        data: {
          ...input,
          stockQuantity: isInventoryCatalogItem(input.type)
            ? (input.stockQuantity ?? 0)
            : null,
          minimumStockQuantity: isInventoryCatalogItem(input.type)
            ? (input.minimumStockQuantity ?? 3)
            : null,
          createdById: user.id,
        },
      });
      response.status(201).json({ catalogItem });
    },
  );

  router.patch(
    "/catalog/:catalogItemId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({
      params: catalogItemIdParams,
      body: catalogUpdateBody,
    }),
    async (_request, response) => {
      const { catalogItemId } =
        paramsOf<z.infer<typeof catalogItemIdParams>>(response);
      const input = bodyOf<z.infer<typeof catalogUpdateBody>>(response);
      const catalogItem = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_catalog_items" WHERE "id" = ${catalogItemId}::uuid FOR UPDATE
        `;
        const existing = await transaction.repairCatalogItem.findUnique({
          where: { id: catalogItemId },
          select: { id: true, type: true, stockQuantity: true },
        });
        if (!existing)
          throw new HttpError(
            404,
            "CATALOG_ITEM_NOT_FOUND",
            "Позиция каталога не найдена.",
          );
        const nextType = input.type ?? existing.type;
        if (input.description !== undefined && nextType !== "PRODUCT") {
          throw new HttpError(
            400,
            "CATALOG_DESCRIPTION_NOT_SUPPORTED",
            "Описание можно задать только для товара.",
          );
        }
        if (
          input.stockQuantity !== undefined &&
          !isInventoryCatalogItem(nextType)
        ) {
          throw new HttpError(
            400,
            "SERVICE_STOCK_NOT_SUPPORTED",
            "Остаток можно указать только для товара или запчасти.",
          );
        }
        if (
          input.minimumStockQuantity !== undefined &&
          !isInventoryCatalogItem(nextType)
        ) {
          throw new HttpError(
            400,
            "SERVICE_STOCK_NOT_SUPPORTED",
            "Порог остатка задаётся только для товара или запчасти.",
          );
        }
        if (
          input.type !== undefined &&
          input.type !== existing.type &&
          (await transaction.shopOrderItem.findFirst({
            where: {
              catalogItemId,
              stockDeducted: true,
              order: { status: "CONFIRMED" },
            },
            select: { id: true },
          }))
        ) {
          throw new HttpError(
            409,
            "SHOP_STOCK_RESERVED",
            "Нельзя менять тип товара, пока подтверждённый заказ удерживает его остаток.",
          );
        }
        if (
          input.type === "SERVICE" &&
          isInventoryCatalogItem(existing.type) &&
          existing.stockQuantity !== null &&
          existing.stockQuantity > 0
        ) {
          throw new HttpError(
            409,
            "CATALOG_STOCK_NOT_EMPTY",
            "Сначала обнулите остаток, затем измените тип позиции.",
          );
        }
        return transaction.repairCatalogItem.update({
          where: { id: catalogItemId },
          data: {
            ...input,
            ...(input.type === "SERVICE"
              ? { stockQuantity: null, minimumStockQuantity: null }
              : input.type !== undefined &&
                  isInventoryCatalogItem(input.type) &&
                  existing.type === "SERVICE"
                ? {
                    stockQuantity: input.stockQuantity ?? 0,
                    minimumStockQuantity: input.minimumStockQuantity ?? 3,
                  }
                : {}),
          },
        });
      });
      response.json({ catalogItem });
    },
  );

  router.delete(
    "/catalog/:catalogItemId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: catalogItemIdParams }),
    async (_request, response) => {
      const { catalogItemId } =
        paramsOf<z.infer<typeof catalogItemIdParams>>(response);
      const imageObjectIds = await database.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`
          SELECT "id" FROM "repair_catalog_items" WHERE "id" = ${catalogItemId}::uuid FOR UPDATE
        `;
          const existing = await transaction.repairCatalogItem.findUnique({
            where: { id: catalogItemId },
            select: {
              id: true,
              type: true,
              stockQuantity: true,
              imageObjectIds: true,
            },
          });
          if (!existing) {
            throw new HttpError(
              404,
              "CATALOG_ITEM_NOT_FOUND",
              "Позиция каталога не найдена.",
            );
          }
          if (existing.type !== "SERVICE" && existing.stockQuantity !== 0) {
            throw new HttpError(
              409,
              "CATALOG_STOCK_NOT_EMPTY",
              "Сначала укажите фактический остаток товара или запчасти и установите его в 0.",
            );
          }

          const openRepairItem = await transaction.repairOrderItem.findFirst({
            where: {
              catalogItemId,
              order: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
            },
            select: { id: true },
          });
          if (openRepairItem) {
            throw new HttpError(
              409,
              "CATALOG_ITEM_IN_OPEN_REPAIR",
              "Нельзя удалить позицию, пока она используется в незавершённом ремонте. Сначала завершите или отмените ремонт.",
            );
          }

          const pendingEstimates = await transaction.repairEstimate.findMany({
            where: {
              status: "PENDING",
              order: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
            },
            select: { itemsSnapshot: true },
          });
          const itemInPendingEstimate = pendingEstimates.some(
            ({ itemsSnapshot }) =>
              Array.isArray(itemsSnapshot) &&
              itemsSnapshot.some(
                (entry) =>
                  typeof entry === "object" &&
                  entry !== null &&
                  !Array.isArray(entry) &&
                  "catalogItemId" in entry &&
                  entry.catalogItemId === catalogItemId,
              ),
          );
          if (itemInPendingEstimate) {
            throw new HttpError(
              409,
              "CATALOG_ITEM_IN_PENDING_ESTIMATE",
              "Нельзя удалить позицию, пока её содержит смета, ожидающая ответа клиента. Сначала обработайте или замените эту смету.",
            );
          }

          const openShopOrderItem = await transaction.shopOrderItem.findFirst({
            where: {
              catalogItemId,
              order: { status: { in: ["PENDING", "CONFIRMED"] } },
            },
            select: { id: true },
          });
          if (openShopOrderItem) {
            throw new HttpError(
              409,
              "CATALOG_ITEM_IN_OPEN_SHOP_ORDER",
              "Нельзя удалить позицию, пока есть ожидающий или подтверждённый заказ магазина. Сначала завершите или отмените заказ.",
            );
          }

          await transaction.repairCatalogItem.delete({
            where: { id: catalogItemId },
          });
          return existing.imageObjectIds;
        },
      );

      await Promise.all(
        imageObjectIds.map((objectId) =>
          storage.delete(objectId).catch(() => undefined),
        ),
      );
      response.status(204).end();
    },
  );

  return router;
};
