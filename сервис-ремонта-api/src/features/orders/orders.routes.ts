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
const createOrderBody = z
  .object({
    deviceType: z.enum(["COMPUTER", "LAPTOP", "PHONE", "TABLET"]),
    problem: z.string().trim().min(5).max(2000),
    address: z.string().trim().min(8).max(500),
    preferredAt: z.string().datetime().nullable().optional(),
  })
  .strict();
const statusBody = z
  .object({
    status: z.enum(["IN_PROGRESS", "COMPLETED", "CANCELLED"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
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
      phoneNumber: role === "TECHNICIAN" || role === "ADMIN",
    },
  },
  assignedTechnician: {
    select: {
      id: true,
      displayName: true,
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
  review: true,
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

  router.post(
    "/orders",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: createOrderBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createOrderBody>>(response);
      const order = await database.$transaction(async (transaction) => {
        const created = await transaction.repairOrder.create({
          data: {
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
        const changed = await transaction.repairOrder.updateMany({
          where: { id: current.id, status: current.status },
          data: { status },
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
          ? { customerId: user.id }
          : user.role === "TECHNICIAN"
            ? { order: { assignedTechnicianId: user.id } }
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
