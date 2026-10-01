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

const productParams = z.object({ itemId: z.string().uuid() });
const orderParams = z.object({ craftOrderId: z.string().uuid() });
const productBody = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(4000),
    priceRub: z.number().int().min(0).max(10_000_000),
    customOrderAvailable: z.boolean().optional(),
    isPublished: z.boolean().optional(),
  })
  .strict();
const updateProductBody = productBody
  .partial()
  .refine((body) => Object.keys(body).length > 0);
const createCraftOrderBody = z
  .object({
    itemId: z.string().uuid().nullable().optional(),
    quantity: z.number().int().min(1).max(99).default(1),
    note: z.string().trim().max(2000).default(""),
    customTitle: z.string().trim().min(2).max(160).optional(),
  })
  .strict()
  .refine(
    (body) => body.itemId || body.customTitle,
    "Укажите изделие или описание заказа.",
  );
const updateCraftOrderBody = z
  .object({
    status: z
      .enum(["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"])
      .optional(),
    quotedPriceRub: z
      .number()
      .int()
      .min(0)
      .max(10_000_000)
      .nullable()
      .optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

export const createCraftsRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const allRoles = requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN");

  router.get(
    "/craft-items",
    requireAuth,
    allRoles,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const items = await database.craftItem.findMany({
        where: user.role === "ADMIN" ? {} : { isPublished: true },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      response.json({ items });
    },
  );

  router.post(
    "/craft-items",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: productBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof productBody>>(response);
      const item = await database.craftItem.create({
        data: {
          ...input,
          customOrderAvailable: input.customOrderAvailable ?? true,
          isPublished: input.isPublished ?? false,
          createdById: user.id,
        },
      });
      response.status(201).json({ item });
    },
  );

  router.patch(
    "/craft-items/:itemId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: productParams, body: updateProductBody }),
    async (_request, response) => {
      const { itemId } = paramsOf<z.infer<typeof productParams>>(response);
      const input = bodyOf<z.infer<typeof updateProductBody>>(response);
      const item = await database.craftItem.update({
        where: { id: itemId },
        data: input,
      });
      response.json({ item });
    },
  );

  router.post(
    "/craft-orders",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: createCraftOrderBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createCraftOrderBody>>(response);
      const item = input.itemId
        ? await database.craftItem.findFirst({
            where: { id: input.itemId, isPublished: true },
          })
        : null;
      if (input.itemId && !item)
        throw new HttpError(404, "CRAFT_ITEM_NOT_FOUND", "Изделие не найдено.");
      if (item && input.customTitle)
        throw new HttpError(
          400,
          "INVALID_CRAFT_ORDER",
          "Выберите изделие или заказное описание.",
        );
      if (input.customTitle && item)
        throw new HttpError(
          400,
          "INVALID_CRAFT_ORDER",
          "Выберите изделие или заказное описание.",
        );
      if (input.customTitle && !input.note)
        throw new HttpError(
          400,
          "CUSTOM_ORDER_DETAILS_REQUIRED",
          "Опишите, что нужно изготовить.",
        );
      if (input.itemId && !item!.customOrderAvailable && input.note)
        throw new HttpError(
          400,
          "CUSTOM_ORDER_UNAVAILABLE",
          "Для этого изделия нельзя запросить индивидуальное изготовление.",
        );
      const order = await database.craftOrder.create({
        data: {
          customerId: user.id,
          itemId: item?.id,
          itemTitleSnapshot: item?.title ?? input.customTitle!,
          unitPriceRubSnapshot: item?.priceRub ?? 0,
          quantity: input.quantity,
          note: input.note,
          isCustomOrder: Boolean(input.customTitle || input.note),
        },
      });
      response.status(201).json({ order });
    },
  );

  router.get(
    "/craft-orders",
    requireAuth,
    allRoles,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const orders = await database.craftOrder.findMany({
        where: user.role === "ADMIN" ? {} : { customerId: user.id },
        include: {
          customer: {
            select: {
              id: true,
              displayName: true,
              email: true,
              phoneNumber: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      });
      response.json({ orders });
    },
  );

  router.patch(
    "/craft-orders/:craftOrderId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderParams, body: updateCraftOrderBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { craftOrderId } = paramsOf<z.infer<typeof orderParams>>(response);
      const input = bodyOf<z.infer<typeof updateCraftOrderBody>>(response);
      const order = await database.craftOrder.update({
        where: { id: craftOrderId },
        data: { ...input, handledById: user.id },
      });
      response.json({ order });
    },
  );

  return router;
};
