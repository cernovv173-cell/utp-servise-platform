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
import { sendPushNotification } from "../notifications/push-notifications.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const reviewRequestSelect = {
  id: true,
  serviceNumber: true,
  customerId: true,
  assignedTechnicianId: true,
  status: true,
  reviewRequestedAt: true,
  review: { select: { id: true } },
} as const;

type ReviewRequestOrder = {
  id: string;
  serviceNumber: string;
  customerId: string;
  assignedTechnicianId: string | null;
  status: string;
  reviewRequestedAt: Date | null;
  review: { id: string } | null;
};

const assertRequestableOrder = (
  order: ReviewRequestOrder | null,
  technicianId: string,
): ReviewRequestOrder => {
  if (!order || order.assignedTechnicianId !== technicianId) {
    throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
  }
  if (order.status !== "COMPLETED") {
    throw new HttpError(
      409,
      "ORDER_NOT_COMPLETED",
      "Запросить отзыв можно после завершения ремонта.",
    );
  }
  if (order.review) {
    throw new HttpError(
      409,
      "REVIEW_ALREADY_EXISTS",
      "Клиент уже оставил отзыв.",
    );
  }
  return order;
};

export const createRepairReviewRequestRouter = (
  database: DatabaseClient,
  notifyCustomer: typeof sendPushNotification = sendPushNotification,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.post(
    "/orders/:orderId/review-request",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const technician = getAuthenticatedUser(response);
      const outcome = await database.$transaction(async (transaction) => {
        const current = assertRequestableOrder(
          await transaction.repairOrder.findUnique({
            where: { id: orderId },
            select: reviewRequestSelect,
          }),
          technician.id,
        );

        if (current.reviewRequestedAt) {
          return {
            customerId: current.customerId,
            serviceNumber: current.serviceNumber,
            reviewRequestedAt: current.reviewRequestedAt,
            alreadyRequested: true,
            shouldNotify: false,
          };
        }

        const reviewRequestedAt = new Date();
        const updated = await transaction.repairOrder.updateMany({
          where: {
            id: orderId,
            status: "COMPLETED",
            assignedTechnicianId: technician.id,
            reviewRequestedAt: null,
          },
          data: {
            reviewRequestedAt,
            reviewRequestedById: technician.id,
          },
        });

        if (updated.count === 0) {
          const latest = assertRequestableOrder(
            await transaction.repairOrder.findUnique({
              where: { id: orderId },
              select: reviewRequestSelect,
            }),
            technician.id,
          );
          if (!latest.reviewRequestedAt) {
            throw new HttpError(
              409,
              "REVIEW_REQUEST_CONFLICT",
              "Заявка изменилась. Обновите список и попробуйте снова.",
            );
          }
          return {
            customerId: latest.customerId,
            serviceNumber: latest.serviceNumber,
            reviewRequestedAt: latest.reviewRequestedAt,
            alreadyRequested: true,
            shouldNotify: false,
          };
        }

        return {
          customerId: current.customerId,
          serviceNumber: current.serviceNumber,
          reviewRequestedAt,
          alreadyRequested: false,
          shouldNotify: true,
        };
      });

      let notificationSent: boolean | null = null;
      if (outcome.shouldNotify) {
        try {
          notificationSent = await notifyCustomer(
            database,
            [outcome.customerId],
            {
              title: "Мастер просит оставить отзыв",
              body: `Если вам удобно, поделитесь впечатлением о ремонте по заявке ${outcome.serviceNumber}.`,
              data: { type: "repair_review_request", orderId },
              androidTag: `repair-review-${orderId}`,
            },
          );
        } catch {
          notificationSent = false;
        }
      }

      response.json({
        reviewRequestedAt: outcome.reviewRequestedAt.toISOString(),
        alreadyRequested: outcome.alreadyRequested,
        notificationSent,
      });
    },
  );

  return router;
};
