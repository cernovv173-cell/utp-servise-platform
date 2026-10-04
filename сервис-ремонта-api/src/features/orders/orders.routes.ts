import { Router } from "express";
import { z } from "zod";

import type { UserRole } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import {
  sendRepairOrderNotification,
  sendRepairOrderNotificationForId,
} from "../notifications/push-notifications.js";
import {
  TECHNICIAN_SALARY_RATE_PERCENT,
  calculateTechnicianSalaryRub,
} from "../salary/salary-calculation.js";
import {
  calculateEarnedPoints,
  calculateMaxBonusDiscount,
  canAddRepairOrderItem,
  canTransitionRepairStatus,
  canViewRepairOrder,
} from "./order-policy.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const reviewIdParams = z.object({ reviewId: z.string().uuid() });
const moderateReviewBody = z.object({ isPublished: z.boolean() }).strict();
const contactPhone = z
  .string()
  .trim()
  .min(7)
  .max(32)
  .refine((value) => (value.match(/\d/g)?.length ?? 0) >= 7);
const createOrderBody = z
  .object({
    deviceType: z.enum(["COMPUTER", "LAPTOP", "PHONE", "TABLET"]),
    problem: z.string().trim().min(5).max(2000),
    contactPhone,
    city: z.string().trim().min(2).max(120),
    street: z.string().trim().min(2).max(180),
    house: z.string().trim().min(1).max(30),
    apartment: z.string().trim().max(30).optional(),
    entrance: z.string().trim().max(30).optional(),
    hasBarrier: z.boolean().optional(),
    floor: z.string().trim().max(20).optional(),
    additionalPhone: z.string().trim().max(32).optional(),
    additionalInfo: z.string().trim().max(500).optional(),
    preferredAt: z.string().datetime().nullable().optional(),
  })
  .strict();
const editOrderBody = z
  .object({
    deviceType: z.enum(["COMPUTER", "LAPTOP", "PHONE", "TABLET"]).optional(),
    problem: z.string().trim().min(5).max(2000).optional(),
    address: z.string().trim().max(500).optional(),
    contactPhone: contactPhone.optional(),
    city: z.string().trim().min(2).max(120).optional(),
    street: z.string().trim().min(2).max(180).optional(),
    house: z.string().trim().min(1).max(30).optional(),
    apartment: z.string().trim().max(30).optional(),
    entrance: z.string().trim().max(30).optional(),
    hasBarrier: z.boolean().optional(),
    floor: z.string().trim().max(20).optional(),
    additionalPhone: z.string().trim().max(32).optional(),
    additionalInfo: z.string().trim().max(500).optional(),
    preferredAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);
const statusBody = z
  .object({
    status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
const expectedCompletionBody = z
  .object({
    expectedCompletionAt: z.string().datetime({ offset: true }).nullable(),
  })
  .strict();
const bonusRedemptionBody = z.object({ redeemBonuses: z.boolean() }).strict();
const receiptPaymentBody = z
  .object({
    paymentMethod: z.enum(["CASH", "CARD_TERMINAL", "BANK_TRANSFER", "OTHER"]),
  })
  .strict();
const receiptDraftBody = z
  .object({
    itemQuantities: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    freeSaleItems: z
      .array(
        z
          .object({
            type: z.enum(["SERVICE", "SPARE_PART"]),
            name: z.string().trim().min(1).max(160),
            quantity: z.number().int().min(1).max(99),
            unitPriceRub: z.number().int().min(1).max(2_147_483_647),
          })
          .strict(),
      )
      .max(50)
      .optional(),
  })
  .strict()
  .superRefine((body, context) => {
    const itemIds = body.itemQuantities?.map((item) => item.itemId) ?? [];
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: "custom",
        message: "Each order item can be updated only once.",
        path: ["itemQuantities"],
      });
    }
  })
  .optional();
const receiptItems = z.array(
  z.object({
    name: z.string(),
    quantity: z.number().int(),
    unitPriceRub: z.number().int(),
    totalRub: z.number().int(),
  }),
);
const assignBody = z.object({ technicianId: z.string().uuid() }).strict();
const orderItemBody = z
  .object({
    catalogItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();
const reviewBody = z
  .object({
    orderId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(3).max(2000),
  })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const orderDetails = (role: UserRole) => ({
  customer: {
    select: {
      id: true,
      displayName: true,
      avatarObjectId: true,
      phoneNumber: role === "TECHNICIAN" || role === "ADMIN",
    },
  },
  assignedTechnician: {
    select: {
      id: true,
      displayName: true,
      avatarObjectId: true,
      phoneNumber: role === "CUSTOMER" || role === "ADMIN",
    },
  },
  statusEvents: {
    orderBy: { createdAt: "desc" as const },
    select: {
      from: true,
      to: true,
      note: true,
      createdAt: true,
      actor: { select: { id: true, displayName: true, role: true } },
    },
  },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: { addedBy: { select: { id: true, displayName: true } } },
  },
  photos: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      objectId: true,
      createdAt: true,
      createdBy: { select: { displayName: true } },
    },
  },
  review: true,
  receipt: true,
});

const addressFromFields = (input: {
  city?: string | null;
  street?: string | null;
  house?: string | null;
  apartment?: string | null;
  entrance?: string | null;
  hasBarrier?: boolean | null;
  floor?: string | null;
  additionalInfo?: string | null;
}): string =>
  [
    [input.city, input.street, input.house ? `д. ${input.house}` : null]
      .filter(Boolean)
      .join(", "),
    input.apartment ? `кв. ${input.apartment}` : null,
    input.entrance ? `подъезд ${input.entrance}` : null,
    input.hasBarrier ? "шлагбаум: да" : null,
    input.floor ? `этаж ${input.floor}` : null,
    input.additionalInfo,
  ]
    .filter(Boolean)
    .join(", ")
    .slice(0, 500);

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createOrdersRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/orders",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const where =
        user.role === "CUSTOMER"
          ? { customerId: user.id }
          : user.role === "TECHNICIAN"
            ? { assignedTechnicianId: user.id }
            : {};
      const orders = await database.repairOrder.findMany({
        where,
        include: orderDetails(user.role),
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
      });
      response.json({ orders });
    },
  );

  router.get(
    "/orders/search",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({
      query: z.object({ serviceNumber: z.string().trim().min(2).max(32) }),
    }),
    async (_request, response) => {
      const query = (
        response.locals.input as {
          readonly query: { readonly serviceNumber: string };
        }
      ).query;
      const orders = await database.repairOrder.findMany({
        where: {
          serviceNumber: { contains: query.serviceNumber, mode: "insensitive" },
        },
        include: orderDetails("ADMIN"),
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      response.json({ orders });
    },
  );

  router.post(
    "/orders",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: createOrderBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createOrderBody>>(response);
      const order = await database.$transaction(async (transaction) => {
        const sequence = await transaction.$queryRaw<Array<{ value: bigint }>>`
          SELECT nextval('repair_service_number_seq') AS value
        `;
        const number = String(sequence[0]?.value ?? "1").padStart(6, "0");
        const address = addressFromFields(input);
        const created = await transaction.repairOrder.create({
          data: {
            serviceNumber: `SRV-${new Date().getUTCFullYear()}-${number}`,
            customerId: user.id,
            deviceType: input.deviceType,
            problem: input.problem,
            address,
            contactPhone: input.contactPhone,
            city: input.city,
            street: input.street,
            house: input.house,
            apartment: input.apartment || null,
            entrance: input.entrance || null,
            hasBarrier: input.hasBarrier ?? false,
            floor: input.floor || null,
            additionalPhone: input.additionalPhone || null,
            additionalInfo: input.additionalInfo || null,
            preferredAt: input.preferredAt ? new Date(input.preferredAt) : null,
          },
        });
        await transaction.repairStatusEvent.create({
          data: {
            orderId: created.id,
            actorId: user.id,
            from: null,
            to: "REQUESTED",
            note: "Заявка создана",
          },
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: created.id },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Создана новая заявка на ремонт.",
      );
      response.status(201).json({ order });
    },
  );

  router.patch(
    "/orders/:orderId",
    requireAuth,
    requireRoles("CUSTOMER", "ADMIN"),
    validateRequest({ params: orderIdParams, body: editOrderBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof editOrderBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            customerId: true,
            assignedTechnicianId: true,
            status: true,
            updatedAt: true,
            city: true,
            street: true,
            house: true,
            apartment: true,
            entrance: true,
            hasBarrier: true,
            floor: true,
            additionalInfo: true,
          },
        });
        if (!current || !canViewRepairOrder(user.role, user.id, current)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        const editableStatus =
          current.status === "REQUESTED" ||
          (user.role === "ADMIN" && current.status === "ASSIGNED");
        if (!editableStatus) {
          throw new HttpError(
            409,
            "ORDER_NOT_EDITABLE",
            "Заявку нельзя изменить после отмены, оплаты чека или начала закрытого этапа ремонта.",
          );
        }
        const addressFieldsChanged = [
          input.city,
          input.street,
          input.house,
          input.apartment,
          input.entrance,
          input.hasBarrier,
          input.floor,
          input.additionalInfo,
        ].some((value) => value !== undefined);
        const address =
          input.address ??
          (addressFieldsChanged
            ? addressFromFields({
                city: input.city ?? current.city,
                street: input.street ?? current.street,
                house: input.house ?? current.house,
                apartment: input.apartment ?? current.apartment,
                entrance: input.entrance ?? current.entrance,
                hasBarrier: input.hasBarrier ?? current.hasBarrier,
                floor: input.floor ?? current.floor,
                additionalInfo: input.additionalInfo ?? current.additionalInfo,
              })
            : undefined);
        const update = await transaction.repairOrder.updateMany({
          where: {
            id: current.id,
            status: current.status,
            updatedAt: current.updatedAt,
          },
          data: {
            deviceType: input.deviceType,
            problem: input.problem,
            address,
            contactPhone: input.contactPhone,
            city: input.city,
            street: input.street,
            house: input.house,
            apartment: input.apartment,
            entrance: input.entrance,
            hasBarrier: input.hasBarrier,
            floor: input.floor,
            additionalPhone: input.additionalPhone,
            additionalInfo: input.additionalInfo,
            preferredAt:
              input.preferredAt === undefined
                ? undefined
                : input.preferredAt
                  ? new Date(input.preferredAt)
                  : null,
          },
        });
        if (update.count !== 1) {
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        }
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Изменены данные заявки на ремонт.",
      );
      response.json({ order });
    },
  );

  router.patch(
    "/orders/:orderId/expected-completion",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: expectedCompletionBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { expectedCompletionAt } =
        bodyOf<z.infer<typeof expectedCompletionBody>>(response);
      const order = await database.repairOrder.update({
        where: { id: orderId },
        data: {
          expectedCompletionAt: expectedCompletionAt
            ? new Date(expectedCompletionAt)
            : null,
        },
        include: orderDetails("ADMIN"),
      });
      await sendRepairOrderNotification(
        database,
        order,
        getAuthenticatedUser(response).id,
        "Обновлён плановый срок завершения ремонта.",
      );
      response.json({ order });
    },
  );

  router.patch(
    "/orders/:orderId/bonus-redemption",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: orderIdParams, body: bonusRedemptionBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const { redeemBonuses } =
        bodyOf<z.infer<typeof bonusRedemptionBody>>(response);
      const updated = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findFirst({
          where: { id: orderId, customerId: user.id },
          include: { items: true, receipt: true },
        });
        if (!order)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (
          order.status === "CANCELLED" ||
          order.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "BONUS_REDEMPTION_CLOSED",
            "Для оплаченной или отменённой заявки нельзя менять использование бонусов.",
          );
        }
        const totalRub = order.items.reduce(
          (sum, item) => sum + item.quantity * item.unitPriceRub,
          0,
        );
        const balance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: user.id },
          _sum: { points: true },
        });
        const bonusDiscountRub = redeemBonuses
          ? calculateMaxBonusDiscount(totalRub, balance._sum.points ?? 0)
          : 0;
        const saved = await transaction.repairOrder.update({
          where: { id: orderId },
          data: { redeemBonuses, bonusDiscountRub },
          include: orderDetails(user.role),
        });
        if (order.receipt) {
          await transaction.repairReceipt.update({
            where: { id: order.receipt.id },
            data: { bonusDiscountRub },
          });
        }
        return saved;
      });
      await sendRepairOrderNotification(
        database,
        updated,
        user.id,
        "Изменено использование бонусов по заявке.",
      );
      response.json({ order: updated });
    },
  );

  router.post(
    "/orders/:orderId/receipt",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: receiptDraftBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof receiptDraftBody>>(response) ?? {};
      const user = getAuthenticatedUser(response);
      const receipt = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: {
            items: { orderBy: { createdAt: "asc" } },
            customer: { select: { displayName: true, phoneNumber: true } },
            receipt: true,
            salaryEntry: true,
          },
        });
        if (!order)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (order.status !== "COMPLETED") {
          throw new HttpError(
            409,
            "ORDER_NOT_COMPLETED",
            "Документ по ремонту можно сформировать после завершения работ.",
          );
        }
        if (order.receipt?.paymentStatus === "PAID") {
          throw new HttpError(
            409,
            "RECEIPT_ALREADY_PAID",
            "Оплаченный чек нельзя изменить.",
          );
        }

        const itemById = new Map(order.items.map((item) => [item.id, item]));
        const requestedItems = input.itemQuantities ?? [];
        if (requestedItems.some((item) => !itemById.has(item.itemId))) {
          throw new HttpError(
            400,
            "ORDER_ITEM_NOT_FOUND",
            "Одна или несколько позиций не принадлежат этой заявке.",
          );
        }

        const updatedItems = [...order.items];
        for (const requestedItem of requestedItems) {
          const currentItem = itemById.get(requestedItem.itemId)!;
          if (currentItem.quantity === requestedItem.quantity) continue;
          const updatedItem = await transaction.repairOrderItem.update({
            where: { id: currentItem.id },
            data: { quantity: requestedItem.quantity },
          });
          const index = updatedItems.findIndex(
            (item) => item.id === updatedItem.id,
          );
          updatedItems[index] = updatedItem;
        }

        for (const freeSaleItem of input.freeSaleItems ?? []) {
          updatedItems.push(
            await transaction.repairOrderItem.create({
              data: {
                orderId,
                catalogItemId: null,
                type: freeSaleItem.type,
                name: freeSaleItem.name,
                quantity: freeSaleItem.quantity,
                unitPriceRub: freeSaleItem.unitPriceRub,
                addedById: user.id,
              },
            }),
          );
        }

        const snapshot = updatedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceRub: item.unitPriceRub,
          totalRub: item.quantity * item.unitPriceRub,
        }));
        const totalRub = snapshot.reduce(
          (total, item) => total + item.totalRub,
          0,
        );
        if (totalRub > 2_147_483_647) {
          throw new HttpError(
            400,
            "ORDER_TOTAL_TOO_LARGE",
            "Итог заказа превышает допустимое значение.",
          );
        }
        const balance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: order.customerId },
          _sum: { points: true },
        });
        const bonusDiscountRub = order.redeemBonuses
          ? calculateMaxBonusDiscount(totalRub, balance._sum.points ?? 0)
          : 0;
        await transaction.repairOrder.update({
          where: { id: orderId },
          data: { bonusDiscountRub },
        });
        if (order.salaryEntry) {
          const serviceTotalRub = updatedItems
            .filter((item) => item.type === "SERVICE")
            .reduce(
              (total, item) => total + item.quantity * item.unitPriceRub,
              0,
            );
          await transaction.technicianSalaryEntry.update({
            where: { id: order.salaryEntry.id },
            data: {
              serviceTotalRub,
              salaryRub: calculateTechnicianSalaryRub(serviceTotalRub),
            },
          });
        }
        const data = {
          orderId,
          receiptNumber: `DOC-${order.serviceNumber}`,
          serviceNumber: order.serviceNumber,
          customerName: order.customer.displayName,
          customerPhone: order.contactPhone ?? order.customer.phoneNumber,
          issuedById: user.id,
          itemsSnapshot: snapshot,
          totalRub,
          bonusDiscountRub,
        };
        return order.receipt
          ? transaction.repairReceipt.update({
              where: { id: order.receipt.id },
              data: { ...data, issuedAt: new Date() },
            })
          : transaction.repairReceipt.create({ data });
      });
      await sendRepairOrderNotificationForId(
        database,
        orderId,
        user.id,
        "По заявке сформирован или обновлён расчётный документ.",
      );
      response.status(201).json({
        receipt: {
          ...receipt,
          itemsSnapshot: receiptItems.parse(receipt.itemsSnapshot),
        },
      });
    },
  );

  router.patch(
    "/orders/:orderId/receipt/payment",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: receiptPaymentBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { paymentMethod } =
        bodyOf<z.infer<typeof receiptPaymentBody>>(response);
      const admin = getAuthenticatedUser(response);
      const receipt = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: { receipt: true },
        });
        if (!order)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (order.status !== "COMPLETED") {
          throw new HttpError(
            409,
            "ORDER_NOT_COMPLETED",
            "Подтвердить оплату можно только после завершения ремонта.",
          );
        }
        if (!order.receipt) {
          throw new HttpError(
            409,
            "RECEIPT_NOT_ISSUED",
            "Сначала сформируйте чек по завершённому ремонту.",
          );
        }
        await transaction.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${order.customerId}::uuid FOR UPDATE
        `;
        const currentReceipt =
          await transaction.repairReceipt.findUniqueOrThrow({
            where: { id: order.receipt.id },
          });
        if (currentReceipt.paymentStatus === "PAID") return currentReceipt;

        const balance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: order.customerId },
          _sum: { points: true },
        });
        const bonusDiscountRub = order.redeemBonuses
          ? calculateMaxBonusDiscount(
              currentReceipt.totalRub,
              balance._sum.points ?? 0,
            )
          : 0;
        const cashPaidRub = currentReceipt.totalRub - bonusDiscountRub;
        const markedPaid = await transaction.repairReceipt.updateMany({
          where: { id: currentReceipt.id, paymentStatus: "PENDING" },
          data: {
            paymentStatus: "PAID",
            paymentMethod,
            paidAt: new Date(),
            bonusDiscountRub,
          },
        });
        if (markedPaid.count !== 1) {
          throw new HttpError(
            409,
            "RECEIPT_PAYMENT_CHANGED",
            "Статус чека уже изменился. Обновите заявку.",
          );
        }
        await transaction.repairOrder.update({
          where: { id: order.id },
          data: { bonusDiscountRub },
        });
        if (bonusDiscountRub > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: order.customerId,
              orderId,
              actorId: admin.id,
              type: "REDEEM",
              points: -bonusDiscountRub,
              reason: `Списание по оплаченному чеку ${currentReceipt.receiptNumber}`,
            },
          });
        }
        const earnedPoints = calculateEarnedPoints(cashPaidRub);
        if (earnedPoints > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: order.customerId,
              orderId,
              actorId: admin.id,
              type: "EARN",
              points: earnedPoints,
              reason: `Начисление 10% по оплаченному чеку ${currentReceipt.receiptNumber}`,
            },
          });
        }
        return transaction.repairReceipt.findUniqueOrThrow({
          where: { id: currentReceipt.id },
        });
      });
      await sendRepairOrderNotificationForId(
        database,
        orderId,
        admin.id,
        "По заявке обновлён статус оплаты.",
      );
      response.json({
        receipt: {
          ...receipt,
          itemsSnapshot: receiptItems.parse(receipt.itemsSnapshot),
        },
      });
    },
  );

  router.patch(
    "/orders/:orderId/assign",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({
      params: orderIdParams,
      body: assignBody,
    }),
    async (_request, response, next) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { technicianId } = bodyOf<z.infer<typeof assignBody>>(response);
      const admin = getAuthenticatedUser(response);
      const technician = await database.user.findUnique({
        where: { id: technicianId },
      });
      if (
        !technician ||
        technician.role !== "TECHNICIAN" ||
        !technician.active
      ) {
        next(
          new HttpError(
            400,
            "INVALID_TECHNICIAN",
            "Выберите активного мастера.",
          ),
        );
        return;
      }
      const order = await database.$transaction(async (transaction) => {
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
        });
        if (!current)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (current.status !== "REQUESTED" && current.status !== "ASSIGNED") {
          throw new HttpError(
            409,
            "ORDER_NOT_ASSIGNABLE",
            "Назначить мастера можно только для новой заявки или заявки в статусе назначения.",
          );
        }
        const nextStatus =
          current.status === "REQUESTED" ? "ASSIGNED" : current.status;
        const update = await transaction.repairOrder.updateMany({
          where: { id: current.id, status: current.status },
          data: { assignedTechnicianId: technicianId, status: nextStatus },
        });
        if (update.count !== 1)
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: admin.id,
            from: current.status,
            to: nextStatus,
            note: current.assignedTechnicianId
              ? `Мастер переназначен: ${technician.displayName}`
              : `Назначен мастер: ${technician.displayName}`,
          },
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(admin.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        admin.id,
        "К заявке назначен или переназначен мастер.",
      );
      response.json({ order });
    },
  );

  router.patch(
    "/orders/:orderId/status",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    validateRequest({
      params: orderIdParams,
      body: statusBody,
    }),
    async (_request, response, next) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { status, note } = bodyOf<z.infer<typeof statusBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
        });
        if (!current || !canViewRepairOrder(user.role, user.id, current)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (!canTransitionRepairStatus(user.role, current.status, status)) {
          throw new HttpError(
            403,
            "STATUS_TRANSITION_FORBIDDEN",
            "Эта роль не может выполнить такой переход статуса.",
          );
        }
        const changed = await transaction.repairOrder.updateMany({
          where: { id: current.id, status: current.status },
          data: {
            status,
            bonusDiscountRub:
              status === "COMPLETED" ? 0 : current.bonusDiscountRub,
          },
        });
        if (changed.count !== 1)
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        const statusEvent = await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: current.status,
            to: status,
            note,
          },
          select: { createdAt: true },
        });
        if (status === "COMPLETED" && current.assignedTechnicianId) {
          const serviceItems = await transaction.repairOrderItem.findMany({
            where: { orderId, type: "SERVICE" },
            select: { quantity: true, unitPriceRub: true },
          });
          const serviceTotalRub = serviceItems.reduce(
            (total, item) => total + item.quantity * item.unitPriceRub,
            0,
          );
          await transaction.technicianSalaryEntry.create({
            data: {
              orderId,
              technicianId: current.assignedTechnicianId,
              serviceTotalRub,
              salaryRub: calculateTechnicianSalaryRub(serviceTotalRub),
              ratePercent: TECHNICIAN_SALARY_RATE_PERCENT,
              earnedAt: statusEvent.createdAt,
            },
          });
        }
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Изменён статус заявки на ремонт.",
      );
      response.json({ order });
    },
  );

  router.post(
    "/orders/:orderId/items",
    requireAuth,
    requireRoles("ADMIN", "TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: orderItemBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof orderItemBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        const existing = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: { id: true, assignedTechnicianId: true },
        });
        if (!existing || !canAddRepairOrderItem(user.role, user.id, existing))
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        const catalogItem = await transaction.repairCatalogItem.findFirst({
          where: { id: input.catalogItemId, active: true },
          select: { id: true, type: true, name: true, unitPriceRub: true },
        });
        if (!catalogItem)
          throw new HttpError(
            404,
            "CATALOG_ITEM_NOT_AVAILABLE",
            "Позиция больше недоступна в каталоге. Обновите список.",
          );
        await transaction.repairOrderItem.create({
          data: {
            orderId,
            catalogItemId: catalogItem.id,
            type: catalogItem.type,
            name: catalogItem.name,
            quantity: input.quantity,
            unitPriceRub: catalogItem.unitPriceRub,
            addedById: user.id,
          },
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Изменён состав услуг или запчастей по заявке.",
      );
      response.status(201).json({ order });
    },
  );

  router.get(
    "/reviews",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const where =
        user.role === "CUSTOMER"
          ? { OR: [{ customerId: user.id }, { isPublished: true }] }
          : user.role === "TECHNICIAN"
            ? { isPublished: true, order: { assignedTechnicianId: user.id } }
            : {};
      const reviews = await database.review.findMany({
        where,
        include: {
          customer: { select: { id: true, displayName: true } },
          order: {
            select: {
              id: true,
              deviceType: true,
              problem: true,
              assignedTechnician: { select: { id: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      response.json({ reviews });
    },
  );

  router.patch(
    "/reviews/:reviewId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: reviewIdParams, body: moderateReviewBody }),
    async (_request, response) => {
      const { reviewId } = paramsOf<z.infer<typeof reviewIdParams>>(response);
      const { isPublished } =
        bodyOf<z.infer<typeof moderateReviewBody>>(response);
      const current = await database.review.findUnique({
        where: { id: reviewId },
        select: { orderId: true },
      });
      const user = getAuthenticatedUser(response);
      const review = await database.review.update({
        where: { id: reviewId },
        data: { isPublished },
      });
      if (current) {
        await sendRepairOrderNotificationForId(
          database,
          current.orderId,
          user.id,
          "Изменён статус отзыва по заявке.",
        );
      }
      response.json({ review });
    },
  );

  router.post(
    "/reviews",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: reviewBody }),
    async (_request, response, next) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof reviewBody>>(response);
      const order = await database.repairOrder.findUnique({
        where: { id: input.orderId },
      });
      if (!order || order.customerId !== user.id) {
        next(new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена."));
        return;
      }
      if (order.status !== "COMPLETED") {
        next(
          new HttpError(
            409,
            "ORDER_NOT_COMPLETED",
            "Отзыв можно оставить после завершения ремонта.",
          ),
        );
        return;
      }
      try {
        const review = await database.review.create({
          data: {
            orderId: order.id,
            customerId: user.id,
            rating: input.rating,
            comment: input.comment,
            isPublished: false,
          },
        });
        await sendRepairOrderNotification(
          database,
          order,
          user.id,
          "К завершённой заявке добавлен отзыв.",
        );
        response.status(201).json({ review });
      } catch (error) {
        if (isUniqueViolation(error))
          next(
            new HttpError(
              409,
              "REVIEW_ALREADY_EXISTS",
              "Для этой заявки отзыв уже оставлен.",
            ),
          );
        else next(error);
      }
    },
  );

  return router;
};
