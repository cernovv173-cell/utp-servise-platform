import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";

const optionalText = (maximumLength: number) =>
  z
    .string()
    .trim()
    .max(maximumLength)
    .nullish()
    .transform((value) => (value === "" ? null : value));

const optionalEmail = z
  .union([z.string().trim().email().max(320), z.literal(""), z.null()])
  .optional()
  .transform((value) => (value === "" ? null : value));

const supplierCreateBody = z
  .object({
    name: z.string().trim().min(2).max(160),
    contactName: optionalText(120),
    phone: optionalText(32),
    email: optionalEmail,
    note: optionalText(1000),
  })
  .strict();

const supplierUpdateBody = z
  .object({
    name: z.string().trim().min(2).max(160).optional(),
    contactName: optionalText(120),
    phone: optionalText(32),
    email: optionalEmail,
    note: optionalText(1000),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

const supplierIdParams = z.object({ supplierId: z.string().uuid() });

const receiptCreateBody = z
  .object({
    supplierId: z.string().uuid(),
    catalogItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(2_147_483_647),
    unitCostRub: z
      .number()
      .int()
      .min(0)
      .max(2_147_483_647)
      .nullable()
      .optional(),
    documentReference: optionalText(120),
  })
  .strict();

type ParsedInput = {
  readonly locals: { readonly input?: unknown };
};

const bodyOf = <T>(response: ParsedInput): T =>
  (response.locals.input as { readonly body: T }).body;

const paramsOf = <T>(response: ParsedInput): T =>
  (response.locals.input as { readonly params: T }).params;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createProcurementRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const requireProcurementAccess = requireRoles("ADMIN", "PROCUREMENT");

  router.get(
    "/admin/operations/suppliers",
    requireAuth,
    requireProcurementAccess,
    async (_request, response) => {
      const suppliers = await database.procurementSupplier.findMany({
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          contactName: true,
          phone: true,
          email: true,
          note: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      });
      response.json({ suppliers });
    },
  );

  router.post(
    "/admin/operations/suppliers",
    requireAuth,
    requireProcurementAccess,
    validateRequest({ body: supplierCreateBody }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof supplierCreateBody>>(response);
      try {
        const supplier = await database.procurementSupplier.create({
          data: {
            name: input.name,
            contactName: input.contactName,
            phone: input.phone,
            email: input.email,
            note: input.note,
          },
        });
        response.status(201).json({ supplier });
      } catch (error) {
        if (isUniqueViolation(error)) {
          next(
            new HttpError(
              409,
              "SUPPLIER_NAME_IN_USE",
              "Поставщик с таким названием уже существует.",
            ),
          );
          return;
        }
        next(error);
      }
    },
  );

  router.patch(
    "/admin/operations/suppliers/:supplierId",
    requireAuth,
    requireProcurementAccess,
    validateRequest({ params: supplierIdParams, body: supplierUpdateBody }),
    async (_request, response, next) => {
      const { supplierId } =
        paramsOf<z.infer<typeof supplierIdParams>>(response);
      const input = bodyOf<z.infer<typeof supplierUpdateBody>>(response);
      const existing = await database.procurementSupplier.findUnique({
        where: { id: supplierId },
        select: { id: true },
      });
      if (!existing) {
        throw new HttpError(404, "SUPPLIER_NOT_FOUND", "Поставщик не найден.");
      }

      try {
        const supplier = await database.procurementSupplier.update({
          where: { id: supplierId },
          data: {
            ...(input.name === undefined ? {} : { name: input.name }),
            ...(input.contactName === undefined
              ? {}
              : { contactName: input.contactName }),
            ...(input.phone === undefined ? {} : { phone: input.phone }),
            ...(input.email === undefined ? {} : { email: input.email }),
            ...(input.note === undefined ? {} : { note: input.note }),
            ...(input.isActive === undefined
              ? {}
              : { isActive: input.isActive }),
          },
        });
        response.json({ supplier });
      } catch (error) {
        if (isUniqueViolation(error)) {
          next(
            new HttpError(
              409,
              "SUPPLIER_NAME_IN_USE",
              "Поставщик с таким названием уже существует.",
            ),
          );
          return;
        }
        next(error);
      }
    },
  );

  router.get(
    "/admin/operations/stock-receipts",
    requireAuth,
    requireProcurementAccess,
    async (_request, response) => {
      const receipts = await database.inventoryStockReceipt.findMany({
        orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          supplierId: true,
          supplierNameSnapshot: true,
          catalogItemId: true,
          itemType: true,
          itemNameSnapshot: true,
          quantity: true,
          unitCostRub: true,
          documentReference: true,
          receivedAt: true,
        },
      });
      response.json({ receipts });
    },
  );

  router.post(
    "/admin/operations/stock-receipts",
    requireAuth,
    requireProcurementAccess,
    validateRequest({ body: receiptCreateBody }),
    async (_request, response) => {
      const input = bodyOf<z.infer<typeof receiptCreateBody>>(response);
      const result = await database.$transaction(async (transaction) => {
        const supplier = await transaction.procurementSupplier.findFirst({
          where: { id: input.supplierId, isActive: true },
          select: { id: true, name: true },
        });
        if (!supplier) {
          throw new HttpError(
            404,
            "ACTIVE_SUPPLIER_NOT_FOUND",
            "Выберите действующего поставщика.",
          );
        }

        const item = await transaction.repairCatalogItem.findUnique({
          where: { id: input.catalogItemId },
          select: {
            id: true,
            type: true,
            name: true,
            active: true,
            stockQuantity: true,
          },
        });
        if (
          !item ||
          !item.active ||
          (item.type !== "SPARE_PART" && item.type !== "PRODUCT")
        ) {
          throw new HttpError(
            404,
            "PURCHASABLE_ITEM_NOT_FOUND",
            "Активный товар или запчасть не найдены.",
          );
        }
        if (item.stockQuantity === null) {
          throw new HttpError(
            409,
            "STOCK_NOT_TRACKED",
            "Сначала укажите фактический остаток этой позиции в каталоге.",
          );
        }

        const updated = await transaction.repairCatalogItem.updateMany({
          where: {
            id: item.id,
            active: true,
            type: { in: ["SPARE_PART", "PRODUCT"] },
            stockQuantity: {
              not: null,
              lte: 2_147_483_647 - input.quantity,
            },
          },
          data: { stockQuantity: { increment: input.quantity } },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "STOCK_RECEIPT_CONFLICT",
            "Остаток изменился или слишком велик. Обновите страницу и повторите операцию.",
          );
        }

        const receipt = await transaction.inventoryStockReceipt.create({
          data: {
            supplierId: supplier.id,
            supplierNameSnapshot: supplier.name,
            catalogItemId: item.id,
            itemType: item.type,
            itemNameSnapshot: item.name,
            quantity: input.quantity,
            unitCostRub: input.unitCostRub ?? null,
            documentReference: input.documentReference,
          },
          select: {
            id: true,
            supplierId: true,
            supplierNameSnapshot: true,
            catalogItemId: true,
            itemType: true,
            itemNameSnapshot: true,
            quantity: true,
            unitCostRub: true,
            documentReference: true,
            receivedAt: true,
          },
        });
        return receipt;
      });

      response.status(201).json({ receipt: result });
    },
  );

  return router;
};
