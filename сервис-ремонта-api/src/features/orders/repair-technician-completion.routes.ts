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
import { scheduleMaxRepairNotification } from "../max/max-notifications.js";
import { sendRepairOrderNotificationForId } from "../notifications/push-notifications.js";
import { assertWorkActApproved } from "./repair-work-act.shared.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

export const createRepairTechnicianCompletionRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.post(
    "/orders/:orderId/technician-completed",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: z.object({}).strict() }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: { workAct: { select: { status: true } } },
        });
        if (!current || current.assignedTechnicianId !== user.id) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (current.status !== "IN_PROGRESS") {
          throw new HttpError(
            409,
            "REPAIR_COMPLETION_NOT_AVAILABLE",
            "Отметить завершение ремонта можно только для заказа в работе.",
          );
        }
        if (
          current.visitScenarioVersion > 0 &&
          current.repairLocation === "CUSTOMER_ADDRESS" &&
          !current.visitPickupAgreedAt
        ) {
          throw new HttpError(
            409,
            "ONSITE_COMPLETION_REQUIRED",
            "Для ремонта на выезде укажите сумму и способ оплаты мастеру; иначе оформите согласованную перевозку в сервис.",
          );
        }
        if (current.visitScenarioVersion > 0) {
          const latestEstimate = await transaction.repairEstimate.findFirst({
            where: { orderId },
            orderBy: { version: "desc" },
            select: { status: true },
          });
          if (latestEstimate?.status === "PENDING") {
            throw new HttpError(
              409,
              "ESTIMATE_RESPONSE_PENDING",
              "Сначала свяжитесь с клиентом по телефону и зафиксируйте ответ по дополнительной смете.",
            );
          }
          assertWorkActApproved(
            current.workActRequired,
            current.workAct?.status,
          );
        }
        if (current.technicianRepairCompletedAt) return current;

        const now = new Date();
        const updated = await transaction.repairOrder.updateMany({
          where: {
            id: orderId,
            status: "IN_PROGRESS",
            technicianRepairCompletedAt: null,
          },
          data: { technicianRepairCompletedAt: now },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        }
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: current.status,
            to: current.status,
            note: "Мастер отметил ремонт завершённым; после оплаты и возврата техники заказ закроет мастер",
          },
        });
        await scheduleMaxRepairNotification(transaction, {
          orderId,
          userId: current.customerId,
          type: "TECHNICIAN_REPAIR_COMPLETED",
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
        });
      });
      await sendRepairOrderNotificationForId(
        database,
        orderId,
        user.id,
        `Мастер отметил ремонт по заявке завершённым. Техник может оформить выдачу клиенту.`,
        "Ремонт выполнен",
      );
      response.json({ order });
    },
  );

  return router;
};
