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
  getChatMessageRecipientIds,
  sendPushNotification,
} from "../notifications/push-notifications.js";
import {
  canAccessOrderChat,
  canRequestAdministratorHelp,
  canSendOrderChatMessage,
} from "./chat-policy.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const messageBody = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const chatDetails = {
  requestedBy: { select: { id: true, displayName: true } },
  joinedBy: { select: { id: true, displayName: true } },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 100,
    include: {
      sender: { select: { id: true, displayName: true, role: true } },
    },
  },
};

const loadChat = (database: DatabaseClient, orderId: string) =>
  database.orderChat.findUnique({ where: { orderId }, include: chatDetails });

type LoadedChat = NonNullable<Awaited<ReturnType<typeof loadChat>>>;

const chatPayload = (chat: LoadedChat | null, orderId: string) =>
  chat
    ? { chat: { ...chat, messages: [...chat.messages].reverse() } }
    : {
        chat: {
          id: null,
          orderId,
          adminRequestedAt: null,
          adminRequestedBy: null,
          adminJoinedAt: null,
          joinedBy: null,
          messages: [],
        },
      };

export const createChatRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/admin/chats",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const chats = await database.orderChat.findMany({
        where: { adminRequestedAt: { not: null } },
        include: {
          order: {
            select: {
              id: true,
              deviceType: true,
              problem: true,
              status: true,
              customer: { select: { id: true, displayName: true } },
              assignedTechnician: {
                select: { id: true, displayName: true },
              },
            },
          },
          requestedBy: { select: { displayName: true } },
          joinedBy: { select: { displayName: true } },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: { select: { displayName: true, role: true } },
            },
          },
        },
        orderBy: [{ adminJoinedAt: "asc" }, { updatedAt: "desc" }],
        take: 100,
      });
      response.json({ chats });
    },
  );

  router.get(
    "/orders/:orderId/chat",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        select: { customerId: true, assignedTechnicianId: true },
      });
      if (!order || !canAccessOrderChat(user.role, user.id, order))
        throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
      response.json(chatPayload(await loadChat(database, orderId), orderId));
    },
  );

  router.post(
    "/orders/:orderId/chat/messages",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    validateRequest({ params: orderIdParams, body: messageBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { content } = bodyOf<z.infer<typeof messageBody>>(response);
      const user = getAuthenticatedUser(response);
      const { chat, recipientIds } = await database.$transaction(
        async (transaction) => {
          const order = await transaction.repairOrder.findUnique({
            where: { id: orderId },
            select: { customerId: true, assignedTechnicianId: true },
          });
          if (!order || !canAccessOrderChat(user.role, user.id, order))
            throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
          const current = await transaction.orderChat.findUnique({
            where: { orderId },
            select: {
              adminRequestedAt: true,
              adminJoinedAt: true,
              adminJoinedById: true,
            },
          });
          if (!canSendOrderChatMessage(user.role, user.id, order, current))
            throw new HttpError(
              403,
              "ADMIN_MUST_JOIN_CHAT",
              "Сначала администратор должен подключиться к беседе.",
            );
          const conversation = await transaction.orderChat.upsert({
            where: { orderId },
            create: { orderId },
            update: {},
            select: { id: true },
          });
          await transaction.orderChatMessage.create({
            data: { chatId: conversation.id, senderId: user.id, content },
          });
          await transaction.orderChat.update({
            where: { orderId },
            data: { updatedAt: new Date() },
          });
          return {
            chat: await transaction.orderChat.findUniqueOrThrow({
              where: { orderId },
              include: chatDetails,
            }),
            recipientIds: getChatMessageRecipientIds({
              customerId: order.customerId,
              assignedTechnicianId: order.assignedTechnicianId,
              joinedAdministratorId: current?.adminJoinedById ?? null,
              senderId: user.id,
            }),
          };
        },
      );
      await sendPushNotification(database, recipientIds, {
        title: "Новое сообщение по ремонту",
        body: "Откройте приложение, чтобы продолжить переписку.",
        data: { type: "chat_message", orderId },
      });
      response.status(201).json(chatPayload(chat, orderId));
    },
  );

  router.post(
    "/orders/:orderId/chat/request-admin",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const { chat, notifyAdminIds } = await database.$transaction(
        async (transaction) => {
          const order = await transaction.repairOrder.findUnique({
            where: { id: orderId },
            select: { customerId: true, assignedTechnicianId: true },
          });
          if (!order || !canRequestAdministratorHelp(user.role, user.id, order))
            throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
          const current = await transaction.orderChat.findUnique({
            where: { orderId },
            select: { adminRequestedAt: true, adminJoinedAt: true },
          });
          if (current?.adminJoinedAt) {
            return {
              chat: await transaction.orderChat.findUniqueOrThrow({
                where: { orderId },
                include: chatDetails,
              }),
              notifyAdminIds: [],
            };
          }
          if (current?.adminRequestedAt) {
            return {
              chat: await transaction.orderChat.findUniqueOrThrow({
                where: { orderId },
                include: chatDetails,
              }),
              notifyAdminIds: [],
            };
          }
          await transaction.orderChat.upsert({
            where: { orderId },
            create: {
              orderId,
              adminRequestedAt: new Date(),
              adminRequestedById: user.id,
            },
            update: {
              adminRequestedAt: new Date(),
              adminRequestedById: user.id,
            },
          });
          await transaction.orderChat.update({
            where: { orderId },
            data: { updatedAt: new Date() },
          });
          const [chat, administrators] = await Promise.all([
            transaction.orderChat.findUniqueOrThrow({
              where: { orderId },
              include: chatDetails,
            }),
            transaction.user.findMany({
              where: { role: "ADMIN", active: true },
              select: { id: true },
            }),
          ]);
          return { chat, notifyAdminIds: administrators.map(({ id }) => id) };
        },
      );
      if (notifyAdminIds.length > 0) {
        await sendPushNotification(database, notifyAdminIds, {
          title: "Новый запрос помощи",
          body: "Мастер просит администратора подключиться к чату.",
          data: { type: "help_request", orderId },
        });
      }
      response.json(chatPayload(chat, orderId));
    },
  );

  router.post(
    "/orders/:orderId/chat/join-admin",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const admin = getAuthenticatedUser(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        select: { id: true },
      });
      if (!order)
        throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
      const chat = await database.$transaction(async (transaction) => {
        const current = await transaction.orderChat.findUnique({
          where: { orderId },
          select: {
            adminJoinedAt: true,
          },
        });
        const joinedAt = current?.adminJoinedAt ?? new Date();
        await transaction.orderChat.upsert({
          where: { orderId },
          create: {
            orderId,
            adminJoinedAt: joinedAt,
            adminJoinedById: admin.id,
          },
          update: current?.adminJoinedAt
            ? {}
            : { adminJoinedAt: joinedAt, adminJoinedById: admin.id },
        });
        return transaction.orderChat.findUniqueOrThrow({
          where: { orderId },
          include: chatDetails,
        });
      });
      response.json(chatPayload(chat, orderId));
    },
  );

  return router;
};
