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
  canAddRepairOrderItem,
  canTransitionRepairStatus,
  canViewRepairOrder,
} from "./order-policy.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const reviewIdParams = z.object({ reviewId: z.string().uuid() });
const moderateReviewBody = z.object({ isPublished: z.boolean() }).strict();
const createOrderBody = z
  .object({
    deviceType: z.enum(["COMPUTER", "LAPTOP", "PHONE", "TABLET"]),
    problem: z.string().trim().min(5).max(2000),
    address: z.string().trim().min(8).max(500),
    preferredAt: z.string().datetime().nullable().optional(),
  })
  .strict();
const editOrderBody = z
  .object({
    deviceType: z.enum(["COMPUTER", "LAPTOP", "PHONE", "TABLET"]).optional(),
    problem: z.string().trim().min(5).max(2000).optional(),
    address: z.string().trim().min(8).max(500).optional(),
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
        const created = await transaction.repairOrder.create({
          data: {
            serviceNumber: `UTP-${new Date().getUTCFullYear()}-${number}`,
            customerId: user.id,
            deviceType: input.deviceType,
            problem: input.problem,
            address: input.address,
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
            "Редактировать можно только новую заявку; администратор также может изменить заявку с назначенным мастером.",
          );
        }
        const update = await transaction.repairOrder.updateMany({
          where: {
            id: current.id,
            status: current.status,
            updatedAt: current.updatedAt,
          },
          data: {
            deviceType: input.deviceType,
            problem: input.problem,
            address: input.address,
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
      const order = await database.repairOrder.findFirst({
        where: { id: orderId, customerId: user.id },
      });
      if (!order)
        throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
      if (order.status === "COMPLETED" || order.status === "CANCELLED") {
        throw new HttpError(
          409,
          "BONUS_REDEMPTION_CLOSED",
          "Для закрытой заявки нельзя менять использование бонусов.",
        );
      }
      const { redeemBonuses } =
        bodyOf<z.infer<typeof bonusRedemptionBody>>(response);
      const updated = await database.repairOrder.update({
        where: { id: orderId },
        data: { redeemBonuses },
        include: orderDetails(user.role),
      });
      response.json({ order: updated });
    },
  );

  router.post(
    "/orders/:orderId/receipt",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const receipt = await database.$transaction(async (transaction) => {
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: { items: { orderBy: { createdAt: "asc" } } },
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
        const snapshot = order.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceRub: item.unitPriceRub,
          totalRub: item.quantity * item.unitPriceRub,
        }));
        const totalRub = snapshot.reduce(
          (total, item) => total + item.totalRub,
          0,
        );
        return transaction.repairReceipt.upsert({
          where: { orderId },
          create: {
            orderId,
            receiptNumber: `DOC-${order.serviceNumber}`,
            issuedById: user.id,
            itemsSnapshot: snapshot,
            totalRub,
            bonusDiscountRub: order.bonusDiscountRub,
          },
          update: {
            issuedById: user.id,
            itemsSnapshot: snapshot,
            totalRub,
            bonusDiscountRub: order.bonusDiscountRub,
            issuedAt: new Date(),
          },
        });
      });
      response
        .status(201)
        .json({
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
        let bonusDiscountRub = 0;
        let earnedPoints = 0;
        if (status === "COMPLETED") {
          const items = await transaction.repairOrderItem.findMany({
            where: { orderId },
            select: { quantity: true, unitPriceRub: true },
          });
          const totalRub = items.reduce(
            (sum, item) => sum + item.quantity * item.unitPriceRub,
            0,
          );
          if (totalRub > 2_147_483_647) {
            throw new HttpError(
              400,
              "ORDER_TOTAL_TOO_LARGE",
              "Итог заказа превышает допустимое значение.",
            );
          }
          if (current.redeemBonuses && totalRub > 0) {
            const balance = await transaction.loyaltyTransaction.aggregate({
              where: { customerId: current.customerId },
              _sum: { points: true },
            });
            bonusDiscountRub = Math.min(
              Math.max(0, balance._sum.points ?? 0),
              Math.floor(totalRub * 0.3),
            );
          }
          earnedPoints = Math.floor((totalRub - bonusDiscountRub) * 0.05);
        }
        const changed = await transaction.repairOrder.updateMany({
          where: { id: current.id, status: current.status },
          data: { status, bonusDiscountRub },
        });
        if (changed.count !== 1)
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: current.status,
            to: status,
            note,
          },
        });
        if (status === "COMPLETED" && bonusDiscountRub > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: current.customerId,
              orderId,
              actorId: user.id,
              type: "REDEEM",
              points: -bonusDiscountRub,
              reason: `Списание на ремонт ${current.serviceNumber}`,
            },
          });
        }
        if (status === "COMPLETED" && earnedPoints > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: current.customerId,
              orderId,
              actorId: user.id,
              type: "EARN",
              points: earnedPoints,
              reason: `Начисление 5% после ремонта ${current.serviceNumber}`,
            },
          });
        }
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
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
      const review = await database.review.update({
        where: { id: reviewId },
        data: { isPublished },
      });
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
          },
        });
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
