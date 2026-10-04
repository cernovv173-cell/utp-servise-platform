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
import { isInventoryCatalogItem } from "./catalog-policy.js";

const catalogItemIdParams = z.object({
  catalogItemId: z.string().uuid(),
});
const itemType = z.enum(["SERVICE", "SPARE_PART", "PRODUCT"]);
const catalogCreateBody = z
  .object({
    type: itemType,
    name: z.string().trim().min(2).max(160),
    unitPriceRub: z.number().int().min(0).max(10_000_000),
    stockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
  })
  .strict()
  .refine(
    (body) =>
      isInventoryCatalogItem(body.type) || body.stockQuantity === undefined,
    {
      message: "Услуги не учитываются на складе.",
      path: ["stockQuantity"],
    },
  );
const catalogUpdateBody = z
  .object({
    type: itemType.optional(),
    name: z.string().trim().min(2).max(160).optional(),
    unitPriceRub: z.number().int().min(0).max(10_000_000).optional(),
    stockQuantity: z.number().int().min(0).max(2_147_483_647).optional(),
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
  );

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

export const createCatalogRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/catalog",
    requireAuth,
    requireRoles("ADMIN", "TECHNICIAN"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const catalogItems = await database.repairCatalogItem.findMany({
        where: user.role === "TECHNICIAN" ? { active: true } : {},
        orderBy: [{ type: "asc" }, { name: "asc" }],
        take: 250,
      });
      response.json({ catalogItems });
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
      const existing = await database.repairCatalogItem.findUnique({
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
      const catalogItem = await database.repairCatalogItem.update({
        where: { id: catalogItemId },
        data: {
          ...input,
          ...(input.type === "SERVICE"
            ? { stockQuantity: null }
            : input.type !== undefined &&
                isInventoryCatalogItem(input.type) &&
                existing.type === "SERVICE"
              ? { stockQuantity: input.stockQuantity ?? 0 }
              : {}),
        },
      });
      response.json({ catalogItem });
    },
  );

  return router;
};
