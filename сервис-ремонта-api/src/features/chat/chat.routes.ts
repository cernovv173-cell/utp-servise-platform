import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
  requireRolesOrStaffPermission,
  requireStaffPermission,
} from "../auth/auth.middleware.js";
import { hasStaffPermission } from "../auth/staff-permissions.js";
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
const readMessageBody = z.object({ messageId: z.string().uuid() }).strict();

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
    requireStaffPermission("communications"),
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
    "/admin/chat-notifications",
    requireAuth,
    requireStaffPermission("communications"),
    async (_request, response) => {
      const admin = getAuthenticatedUser(response);
      const chats = await database.orderChat.findMany({
        where: { messages: { some: { senderId: { not: admin.id } } } },
        select: {
          orderId: true,
          adminReadReceipts: {
            where: { adminId: admin.id },
            select: { lastReadAt: true },
            take: 1,
          },
          order: {
            select: {
              serviceNumber: true,
              customer: { select: { displayName: true } },
            },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              id: true,
              senderId: true,
              content: true,
              createdAt: true,
              sender: { select: { displayName: true, role: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });
      const unreadChats = chats.flatMap((chat) => {
        const lastMessage = chat.messages[0];
        const lastReadAt = chat.adminReadReceipts[0]?.lastReadAt;
        if (
          !lastMessage ||
          lastMessage.senderId === admin.id ||
          (lastReadAt && lastMessage.createdAt <= lastReadAt)
        )
          return [];
        return [
          {
            orderId: chat.orderId,
            serviceNumber: chat.order.serviceNumber,
            customerName: chat.order.customer.displayName,
            lastMessageId: lastMessage.id,
            lastMessageAt: lastMessage.createdAt,
            senderName: lastMessage.sender?.displayName ?? "Участник заявки",
            preview: lastMessage.content.slice(0, 160),
          },
        ];
      });
      response.json({ totalUnread: unreadChats.length, chats: unreadChats });
    },
  );

  router.get(
    "/orders/:orderId/chat",
    requireAuth,
    requireRolesOrStaffPermission(
      "communications",
      "CUSTOMER",
      "TECHNICIAN",
      "ADMIN",
    ),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        select: { customerId: true, assignedTechnicianId: true },
      });
      if (
        !order ||
        !canAccessOrderChat(
          user.role,
          user.id,
          order,
          hasStaffPermission(user, "communications"),
          hasStaffPermission(user, "repairs"),
        )
      )
        throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
      response.json(chatPayload(await loadChat(database, orderId), orderId));
    },
  );

  router.post(
    "/orders/:orderId/chat/read",
    requireAuth,
    requireStaffPermission("communications"),
    validateRequest({ params: orderIdParams, body: readMessageBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { messageId } = bodyOf<z.infer<typeof readMessageBody>>(response);
      const admin = getAuthenticatedUser(response);
      await database.$transaction(async (transaction) => {
        const chat = await transaction.orderChat.findUnique({
          where: { orderId },
          select: { id: true },
        });
        if (!chat)
          throw new HttpError(404, "CHAT_NOT_FOUND", "Чат заявки не найден.");
        const message = await transaction.orderChatMessage.findFirst({
          where: { id: messageId, chatId: chat.id },
          select: { createdAt: true },
        });
        if (!message)
          throw new HttpError(
            404,
            "CHAT_MESSAGE_NOT_FOUND",
            "Сообщение не найдено.",
          );
        const readReceipt = await transaction.orderChatAdminRead.findUnique({
          where: { chatId_adminId: { chatId: chat.id, adminId: admin.id } },
          select: { lastReadAt: true },
        });
        if (!readReceipt) {
          await transaction.orderChatAdminRead.create({
            data: {
              chatId: chat.id,
              adminId: admin.id,
              lastReadAt: message.createdAt,
            },
          });
        } else if (message.createdAt > readReceipt.lastReadAt) {
          await transaction.orderChatAdminRead.update({
            where: { chatId_adminId: { chatId: chat.id, adminId: admin.id } },
            data: { lastReadAt: message.createdAt },
          });
        }
      });
      response.status(204).end();
    },
  );

  router.post(
    "/orders/:orderId/chat/messages",
    requireAuth,
    requireRolesOrStaffPermission(
      "communications",
      "CUSTOMER",
      "TECHNICIAN",
      "ADMIN",
    ),
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
          if (
            !order ||
            !canAccessOrderChat(
              user.role,
              user.id,
              order,
              hasStaffPermission(user, "communications"),
              hasStaffPermission(user, "repairs"),
            )
          )
            throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
          const current = await transaction.orderChat.findUnique({
            where: { orderId },
            select: {
              adminRequestedAt: true,
              adminJoinedAt: true,
              adminJoinedById: true,
            },
          });
          if (
            !canSendOrderChatMessage(
              user.role,
              user.id,
              order,
              current,
              hasStaffPermission(user, "communications"),
              hasStaffPermission(user, "repairs"),
            )
          )
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
          const administrators =
            user.role === "ADMIN"
              ? []
              : await transaction.user.findMany({
                  where: { role: "ADMIN", active: true },
                  select: { id: true },
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
              administratorIds: administrators.map(({ id }) => id),
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
          if (
            !order ||
            !canRequestAdministratorHelp(
              user.role,
              user.id,
              order,
              hasStaffPermission(user, "repairs"),
            )
          )
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
    requireStaffPermission("communications"),
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
