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
const responseBody = z
  .object({ response: z.enum(["WORKING", "NEEDS_HELP"]) })
  .strict();

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;

const followUpInclude = {
  order: {
    select: {
      customerId: true,
      serviceNumber: true,
      deviceType: true,
      deviceBrand: true,
      deviceModel: true,
      review: { select: { id: true } },
    },
  },
} as const;

const toPayload = (followUp: {
  id: string;
  orderId: string;
  status: string;
  scheduledAt: Date;
  sentAt: Date | null;
  answeredAt: Date | null;
  order: {
    serviceNumber: string;
    deviceType: string;
    deviceBrand: string | null;
    deviceModel: string | null;
    review: { id: string } | null;
  };
}) => {
  const hasReview = followUp.order.review !== null;
  return {
    id: followUp.id,
    orderId: followUp.orderId,
    status: followUp.status,
    scheduledAt: followUp.scheduledAt,
    sentAt: followUp.sentAt,
    answeredAt: followUp.answeredAt,
    order: {
      serviceNumber: followUp.order.serviceNumber,
      deviceType: followUp.order.deviceType,
      deviceBrand: followUp.order.deviceBrand,
      deviceModel: followUp.order.deviceModel,
      hasReview,
    },
  };
};

export const createRepairFollowUpRouter = (
  database: DatabaseClient,
  notifyAdministrators: typeof sendPushNotification = sendPushNotification,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/orders/:orderId/repair-follow-up",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const customer = getAuthenticatedUser(response);
      const followUp = await database.repairOrderFollowUp.findUnique({
        where: { orderId },
        include: followUpInclude,
      });
      if (!followUp || followUp.order.customerId !== customer.id) {
        throw new HttpError(
          404,
          "FOLLOW_UP_NOT_FOUND",
          "Напоминание не найдено.",
        );
      }
      response.json({ followUp: toPayload(followUp) });
    },
  );

  router.post(
    "/orders/:orderId/repair-follow-up",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: orderIdParams, body: responseBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { response: answer } =
        bodyOf<z.infer<typeof responseBody>>(response);
      const customer = getAuthenticatedUser(response);

      const outcome = await database.$transaction(async (transaction) => {
        const current = await transaction.repairOrderFollowUp.findUnique({
          where: { orderId },
          include: followUpInclude,
        });
        if (!current || current.order.customerId !== customer.id) {
          throw new HttpError(
            404,
            "FOLLOW_UP_NOT_FOUND",
            "Напоминание не найдено.",
          );
        }
        if (current.status === answer) {
          return { administratorIds: [] as string[], shouldNotify: false };
        }
        if (current.status !== "SENT") {
          throw new HttpError(
            409,
            "FOLLOW_UP_ALREADY_ANSWERED",
            "Ответ по этому ремонту уже сохранён.",
          );
        }

        const updated = await transaction.repairOrderFollowUp.updateMany({
          where: { id: current.id, status: "SENT" },
          data: { status: answer, answeredAt: new Date(), lockedUntil: null },
        });
        if (updated.count !== 1) {
          const latest = await transaction.repairOrderFollowUp.findUnique({
            where: { id: current.id },
            select: { status: true },
          });
          if (latest?.status === answer) {
            return { administratorIds: [] as string[], shouldNotify: false };
          }
          throw new HttpError(
            409,
            "FOLLOW_UP_ALREADY_ANSWERED",
            "Ответ по этому ремонту уже сохранён.",
          );
        }

        if (answer !== "NEEDS_HELP") {
          return { administratorIds: [] as string[], shouldNotify: false };
        }

        const conversation = await transaction.supportConversation.upsert({
          where: { customerId: customer.id },
          create: { customerId: customer.id },
          update: { updatedAt: new Date() },
          select: { id: true },
        });
        await transaction.supportChatMessage.create({
          data: {
            chatId: conversation.id,
            senderId: customer.id,
            content: `После ремонта по заявке ${current.order.serviceNumber} нужна помощь. Пожалуйста, свяжитесь со мной.`,
          },
        });
        const administrators = await transaction.user.findMany({
          where: { role: "ADMIN", active: true },
          select: { id: true },
        });
        return {
          administratorIds: administrators.map(({ id }) => id),
          shouldNotify: true,
        };
      });

      if (outcome.shouldNotify) {
        await notifyAdministrators(database, outcome.administratorIds, {
          title: "Клиенту нужна помощь после ремонта",
          body: "В чате поддержки появилось сообщение по завершённому ремонту.",
          data: { type: "support_chat_message", customerId: customer.id },
        });
      }

      const followUp = await database.repairOrderFollowUp.findUnique({
        where: { orderId },
        include: followUpInclude,
      });
      if (!followUp || followUp.order.customerId !== customer.id) {
        throw new HttpError(
          404,
          "FOLLOW_UP_NOT_FOUND",
          "Напоминание не найдено.",
        );
      }
      response.json({ followUp: toPayload(followUp) });
    },
  );

  return router;
};
