import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
  requireStaffPermission,
} from "../auth/auth.middleware.js";
import { sendPushNotification } from "../notifications/push-notifications.js";

const customerIdParams = z.object({ customerId: z.string().uuid() });
const messageBody = z
  .object({ content: z.string().trim().min(1).max(2000) })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const chatDetails = {
  customer: {
    select: {
      id: true,
      displayName: true,
      email: true,
      phoneNumber: true,
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 100,
    include: {
      sender: { select: { id: true, displayName: true, role: true } },
    },
  },
};

const chatPayload = <T extends { readonly messages: readonly unknown[] }>(
  chat: T,
) => ({ ...chat, messages: [...chat.messages].reverse() });

export const createSupportChatRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/support/chat",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const customer = getAuthenticatedUser(response);
      const chat = await database.supportConversation.findUnique({
        where: { customerId: customer.id },
        include: chatDetails,
      });
      response.json({
        chat: chat
          ? chatPayload(chat)
          : {
              id: null,
              customerId: customer.id,
              customer: {
                id: customer.id,
                displayName: customer.displayName,
                email: customer.email,
                phoneNumber: customer.phoneNumber,
              },
              messages: [],
            },
      });
    },
  );

  router.post(
    "/support/chat/messages",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: messageBody }),
    async (_request, response) => {
      const customer = getAuthenticatedUser(response);
      const { content } = bodyOf<z.infer<typeof messageBody>>(response);
      const { chat, administratorIds } = await database.$transaction(
        async (transaction) => {
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
              content,
            },
          });
          const [savedChat, administrators] = await Promise.all([
            transaction.supportConversation.findUniqueOrThrow({
              where: { customerId: customer.id },
              include: chatDetails,
            }),
            transaction.user.findMany({
              where: { role: "ADMIN", active: true },
              select: { id: true },
            }),
          ]);
          return {
            chat: savedChat,
            administratorIds: administrators.map(({ id }) => id),
          };
        },
      );
      await sendPushNotification(database, administratorIds, {
        title: "Новое сообщение клиента",
        body: "Клиент написал в чат поддержки.",
        data: { type: "support_chat_message", customerId: customer.id },
      });
      response.status(201).json({ chat: chatPayload(chat) });
    },
  );

  router.get(
    "/admin/support/chats",
    requireAuth,
    requireStaffPermission("communications"),
    async (_request, response) => {
      const chats = await database.supportConversation.findMany({
        include: {
          customer: {
            select: { id: true, displayName: true, email: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            include: {
              sender: { select: { displayName: true, role: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
        take: 100,
      });
      response.json({ chats });
    },
  );

  router.get(
    "/admin/support/chats/:customerId",
    requireAuth,
    requireStaffPermission("communications"),
    validateRequest({ params: customerIdParams }),
    async (_request, response) => {
      const { customerId } =
        paramsOf<z.infer<typeof customerIdParams>>(response);
      const chat = await database.supportConversation.findUnique({
        where: { customerId },
        include: chatDetails,
      });
      if (!chat)
        throw new HttpError(404, "CHAT_NOT_FOUND", "Беседа не найдена.");
      response.json({ chat: chatPayload(chat) });
    },
  );

  router.post(
    "/admin/support/chats/:customerId/messages",
    requireAuth,
    requireStaffPermission("communications"),
    validateRequest({ params: customerIdParams, body: messageBody }),
    async (_request, response) => {
      const admin = getAuthenticatedUser(response);
      const { customerId } =
        paramsOf<z.infer<typeof customerIdParams>>(response);
      const { content } = bodyOf<z.infer<typeof messageBody>>(response);
      const chat = await database.$transaction(async (transaction) => {
        const customer = await transaction.user.findFirst({
          where: { id: customerId, role: "CUSTOMER" },
          select: { id: true },
        });
        if (!customer)
          throw new HttpError(404, "CUSTOMER_NOT_FOUND", "Клиент не найден.");
        const conversation = await transaction.supportConversation.findUnique({
          where: { customerId },
          select: { id: true },
        });
        if (!conversation)
          throw new HttpError(404, "CHAT_NOT_FOUND", "Беседа не найдена.");
        await transaction.supportChatMessage.create({
          data: { chatId: conversation.id, senderId: admin.id, content },
        });
        await transaction.supportConversation.update({
          where: { customerId },
          data: { updatedAt: new Date() },
        });
        return transaction.supportConversation.findUniqueOrThrow({
          where: { customerId },
          include: chatDetails,
        });
      });
      await sendPushNotification(database, [customerId], {
        title: "Ответ администратора",
        body: "В чате поддержки появилось новое сообщение.",
        data: { type: "support_chat_message", customerId },
      });
      response.status(201).json({ chat: chatPayload(chat) });
    },
  );

  return router;
};
