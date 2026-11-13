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
import { sendPushNotification } from "../notifications/push-notifications.js";
import { calculateEarnedPoints } from "../orders/order-policy.js";
import { calculateTechnicianSalaryRub } from "../salary/salary-calculation.js";
import { canAccessCraftOrderChat } from "./craft-chat-policy.js";
import {
  calculateCraftOrderEarnedPoints,
  calculateCraftOrderTotalRub,
} from "./craft-order-policy.js";

const productParams = z.object({ itemId: z.string().uuid() });
const orderParams = z.object({ craftOrderId: z.string().uuid() });
const productBody = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: z.string().trim().max(4000),
    priceRub: z.number().int().min(0).max(10_000_000),
    stockQuantity: z.number().int().min(0).max(100_000).optional(),
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
    assignedTechnicianId: z.string().uuid().nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);
const craftReceiptPaymentBody = z
  .object({
    paymentMethod: z.enum(["CASH", "CARD_TERMINAL", "BANK_TRANSFER", "OTHER"]),
  })
  .strict();
const craftChatMessageBody = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

export const createCraftsRouter = (
  database: DatabaseClient,
  notify: typeof sendPushNotification = sendPushNotification,
  storage: MediaStorage = projectMediaStorage,
): Router => {
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
          stockQuantity: input.stockQuantity ?? 0,
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

  router.delete(
    "/craft-items/:itemId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: productParams }),
    async (_request, response) => {
      const { itemId } = paramsOf<z.infer<typeof productParams>>(response);
      const imageObjectIds = await database.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`
          SELECT "id" FROM "craft_items" WHERE "id" = ${itemId}::uuid FOR UPDATE
        `;
          const existing = await transaction.craftItem.findUnique({
            where: { id: itemId },
            select: { imageObjectId: true, imageObjectIds: true },
          });
          if (!existing) {
            throw new HttpError(
              404,
              "CRAFT_ITEM_NOT_FOUND",
              "Изделие не найдено.",
            );
          }

          const activeCraftOrder = await transaction.craftOrder.findFirst({
            where: {
              itemId,
              status: { in: ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] },
            },
            select: { id: true },
          });
          if (activeCraftOrder) {
            throw new HttpError(
              409,
              "CRAFT_ITEM_IN_OPEN_ORDER",
              "Нельзя удалить изделие, пока есть незавершённая заявка на его изготовление. Сначала завершите или отмените её.",
            );
          }

          const openShopOrderItem = await transaction.shopOrderItem.findFirst({
            where: {
              craftItemId: itemId,
              order: { status: { in: ["PENDING", "CONFIRMED"] } },
            },
            select: { id: true },
          });
          if (openShopOrderItem) {
            throw new HttpError(
              409,
              "CRAFT_ITEM_IN_OPEN_SHOP_ORDER",
              "Нельзя удалить изделие, пока есть ожидающий или подтверждённый заказ магазина. Сначала завершите или отмените заказ.",
            );
          }

          await transaction.craftItem.delete({ where: { id: itemId } });
          return Array.from(
            new Set([...existing.imageObjectIds, existing.imageObjectId]),
          ).filter((objectId): objectId is string => objectId !== null);
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
      if (input.itemId && !item!.customOrderAvailable)
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
          assignedTechnician: {
            select: { id: true, displayName: true, salaryRatePercent: true },
          },
          receipt: true,
          salaryEntry: true,
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
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "craft_orders" WHERE "id" = ${craftOrderId}::uuid FOR UPDATE
        `;
        const current = await transaction.craftOrder.findUnique({
          where: { id: craftOrderId },
          include: { customer: true, receipt: true, salaryEntry: true },
        });
        if (!current)
          throw new HttpError(
            404,
            "CRAFT_ORDER_NOT_FOUND",
            "Заявка не найдена.",
          );

        if (current.status === "COMPLETED") {
          if (
            (input.status && input.status !== "COMPLETED") ||
            input.quotedPriceRub !== undefined ||
            input.assignedTechnicianId !== undefined
          ) {
            throw new HttpError(
              409,
              "CRAFT_ORDER_FINALIZED",
              "Завершённую заявку и её расчёт изменить нельзя.",
            );
          }
          return transaction.craftOrder.findUniqueOrThrow({
            where: { id: craftOrderId },
            include: {
              customer: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  phoneNumber: true,
                },
              },
              assignedTechnician: {
                select: {
                  id: true,
                  displayName: true,
                  salaryRatePercent: true,
                },
              },
              receipt: true,
              salaryEntry: true,
            },
          });
        }

        const technicianId =
          input.assignedTechnicianId !== undefined
            ? input.assignedTechnicianId
            : current.assignedTechnicianId;
        const quotedPriceRub =
          input.quotedPriceRub !== undefined
            ? input.quotedPriceRub
            : current.quotedPriceRub;
        const status = input.status ?? current.status;
        const updateData = {
          status,
          quotedPriceRub,
          assignedTechnicianId: technicianId,
          handledById: user.id,
        };

        if (status !== "COMPLETED") {
          await transaction.craftOrder.update({
            where: { id: craftOrderId },
            data: updateData,
          });
          return transaction.craftOrder.findUniqueOrThrow({
            where: { id: craftOrderId },
            include: {
              customer: {
                select: {
                  id: true,
                  displayName: true,
                  email: true,
                  phoneNumber: true,
                },
              },
              assignedTechnician: {
                select: {
                  id: true,
                  displayName: true,
                  salaryRatePercent: true,
                },
              },
              receipt: true,
              salaryEntry: true,
            },
          });
        }

        if (!technicianId) {
          throw new HttpError(
            400,
            "CRAFT_TECHNICIAN_REQUIRED",
            "Назначьте мастера перед завершением заявки.",
          );
        }
        const technician = await transaction.user.findFirst({
          where: { id: technicianId, role: "TECHNICIAN", active: true },
          select: { id: true, salaryRatePercent: true },
        });
        if (!technician) {
          throw new HttpError(
            400,
            "CRAFT_TECHNICIAN_INVALID",
            "Выберите активного мастера.",
          );
        }
        const unitPriceRub = quotedPriceRub ?? current.unitPriceRubSnapshot;
        if (current.isCustomOrder && unitPriceRub <= 0) {
          throw new HttpError(
            400,
            "CRAFT_PRICE_REQUIRED",
            "Укажите цену изделия перед завершением заявки.",
          );
        }
        const totalRub = calculateCraftOrderTotalRub(
          unitPriceRub,
          current.quantity,
        );
        if (totalRub > 2_147_483_647) {
          throw new HttpError(
            400,
            "CRAFT_TOTAL_TOO_LARGE",
            "Итог заказа превышает допустимое значение.",
          );
        }
        const sequence = await transaction.$queryRaw<Array<{ value: bigint }>>`
          SELECT nextval('repair_service_number_seq') AS value
        `;
        const sequenceNumber = String(sequence[0]?.value ?? "1").padStart(
          6,
          "0",
        );
        const serviceNumber = `SRV-${new Date().getUTCFullYear()}-${sequenceNumber}`;
        const completedAt = new Date();
        await transaction.craftOrder.update({
          where: { id: craftOrderId },
          data: {
            ...updateData,
            serviceNumber,
            status: "COMPLETED",
          },
        });
        const receiptNumber = `DOC-${serviceNumber}`;
        await transaction.craftOrderReceipt.create({
          data: {
            craftOrderId,
            receiptNumber,
            serviceNumber,
            customerName: current.customer.displayName,
            customerPhone: current.customer.phoneNumber,
            issuedById: user.id,
            itemsSnapshot: [
              {
                name: current.itemTitleSnapshot,
                quantity: current.quantity,
                unitPriceRub,
                totalRub,
              },
            ],
            totalRub,
            bonusDiscountRub: 0,
          },
        });
        const ratePercent = technician.salaryRatePercent ?? 75;
        await transaction.craftOrderSalaryEntry.create({
          data: {
            craftOrderId,
            technicianId: technician.id,
            serviceTotalRub: totalRub,
            salaryRub: calculateTechnicianSalaryRub(totalRub, ratePercent),
            ratePercent,
            earnedAt: completedAt,
          },
        });
        return transaction.craftOrder.findUniqueOrThrow({
          where: { id: craftOrderId },
          include: {
            customer: {
              select: {
                id: true,
                displayName: true,
                email: true,
                phoneNumber: true,
              },
            },
            assignedTechnician: {
              select: { id: true, displayName: true, salaryRatePercent: true },
            },
            receipt: true,
            salaryEntry: true,
          },
        });
      });
      response.json({ order });
    },
  );

  router.patch(
    "/craft-orders/:craftOrderId/bonus-redemption",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderParams }),
    async () => {
      throw new HttpError(
        409,
        "BONUS_REDEMPTION_SERVICES_ONLY",
        "Бонусы можно списывать только за услуги по ремонту, не за заказные изделия.",
      );
    },
  );

  router.patch(
    "/craft-orders/:craftOrderId/receipt/payment",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderParams, body: craftReceiptPaymentBody }),
    async (_request, response) => {
      const { craftOrderId } = paramsOf<z.infer<typeof orderParams>>(response);
      const { paymentMethod } =
        bodyOf<z.infer<typeof craftReceiptPaymentBody>>(response);
      const admin = getAuthenticatedUser(response);
      const receipt = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "craft_orders" WHERE "id" = ${craftOrderId}::uuid FOR UPDATE
        `;
        const order = await transaction.craftOrder.findUnique({
          where: { id: craftOrderId },
          include: { receipt: true },
        });
        if (!order)
          throw new HttpError(
            404,
            "CRAFT_ORDER_NOT_FOUND",
            "Заявка не найдена.",
          );
        if (order.status !== "COMPLETED" || !order.receipt) {
          throw new HttpError(
            409,
            "CRAFT_RECEIPT_NOT_READY",
            "Сначала завершите заявку и сформируйте чек.",
          );
        }
        if (order.receipt.paymentStatus === "PAID") return order.receipt;
        await transaction.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${order.customerId}::uuid FOR UPDATE
        `;
        const cashPaidRub = order.receipt.totalRub;
        const changed = await transaction.craftOrderReceipt.updateMany({
          where: { id: order.receipt.id, paymentStatus: "PENDING" },
          data: {
            paymentStatus: "PAID",
            paymentMethod,
            paidAt: new Date(),
            bonusDiscountRub: 0,
          },
        });
        if (changed.count !== 1) {
          throw new HttpError(
            409,
            "CRAFT_RECEIPT_PAYMENT_CHANGED",
            "Статус чека уже изменился. Обновите заявку.",
          );
        }
        await transaction.craftOrder.update({
          where: { id: craftOrderId },
          data: { redeemBonuses: false, bonusDiscountRub: 0 },
        });
        const earnedPoints = calculateCraftOrderEarnedPoints(cashPaidRub);
        if (earnedPoints > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: order.customerId,
              craftOrderId,
              actorId: admin.id,
              type: "EARN",
              points: earnedPoints,
              reason: `Начисление 5% за заказ изделия ${order.receipt.serviceNumber}`,
            },
          });
        }
        return transaction.craftOrderReceipt.findUniqueOrThrow({
          where: { id: order.receipt.id },
        });
      });
      response.json({ receipt });
    },
  );

  router.get(
    "/craft-orders/:craftOrderId/chat",
    requireAuth,
    requireRoles("CUSTOMER", "ADMIN"),
    validateRequest({ params: orderParams }),
    async (_request, response) => {
      const { craftOrderId } = paramsOf<z.infer<typeof orderParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.craftOrder.findUnique({
        where: { id: craftOrderId },
        select: { id: true, customerId: true },
      });
      if (!order || !canAccessCraftOrderChat(user.role, user.id, order))
        throw new HttpError(404, "CRAFT_ORDER_NOT_FOUND", "Заявка не найдена.");

      const messages = await database.craftOrderChatMessage.findMany({
        where: { craftOrderId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          sender: { select: { id: true, displayName: true, role: true } },
        },
      });
      response.json({
        chat: {
          id: craftOrderId,
          craftOrderId,
          messages: [...messages].reverse(),
        },
      });
    },
  );

  router.post(
    "/craft-orders/:craftOrderId/chat/messages",
    requireAuth,
    requireRoles("CUSTOMER", "ADMIN"),
    validateRequest({ params: orderParams, body: craftChatMessageBody }),
    async (_request, response) => {
      const { craftOrderId } = paramsOf<z.infer<typeof orderParams>>(response);
      const { content } =
        bodyOf<z.infer<typeof craftChatMessageBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.craftOrder.findUnique({
        where: { id: craftOrderId },
        select: { id: true, customerId: true },
      });
      if (!order || !canAccessCraftOrderChat(user.role, user.id, order))
        throw new HttpError(404, "CRAFT_ORDER_NOT_FOUND", "Заявка не найдена.");

      await database.craftOrderChatMessage.create({
        data: { craftOrderId, senderId: user.id, content },
      });
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
        title: "Новое сообщение по заявке на изделие",
        body: "Откройте заявку, чтобы продолжить переписку.",
        data: { type: "craft_order_chat_message", craftOrderId },
      });

      const messages = await database.craftOrderChatMessage.findMany({
        where: { craftOrderId },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: {
          sender: { select: { id: true, displayName: true, role: true } },
        },
      });
      response.status(201).json({
        chat: {
          id: craftOrderId,
          craftOrderId,
          messages: [...messages].reverse(),
        },
      });
    },
  );

  return router;
};
