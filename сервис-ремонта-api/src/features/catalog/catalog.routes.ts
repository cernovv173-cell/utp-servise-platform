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

const catalogItemIdParams = z.object({
  catalogItemId: z.string().uuid(),
});
const itemType = z.enum(["SERVICE", "SPARE_PART"]);
const catalogCreateBody = z
  .object({
    type: itemType,
    name: z.string().trim().min(2).max(160),
    unitPriceRub: z.number().int().min(0).max(10_000_000),
  })
  .strict();
const catalogUpdateBody = z
  .object({
    type: itemType.optional(),
    name: z.string().trim().min(2).max(160).optional(),
    unitPriceRub: z.number().int().min(0).max(10_000_000).optional(),
    active: z.boolean().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);

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
        data: { ...input, createdById: user.id },
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
        select: { id: true },
      });
      if (!existing)
        throw new HttpError(
          404,
          "CATALOG_ITEM_NOT_FOUND",
          "Позиция каталога не найдена.",
        );
      const catalogItem = await database.repairCatalogItem.update({
        where: { id: catalogItemId },
        data: input,
      });
      response.json({ catalogItem });
    },
  );

  return router;
};
