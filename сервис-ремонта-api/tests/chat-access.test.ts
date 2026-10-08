import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createChatRouter } from "../src/features/chat/chat.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const orderId = "11111111-1111-4111-8111-111111111111";
const otherOrderId = "22222222-2222-4222-8222-222222222222";
const adminToken = "A".repeat(48);
const customerToken = "C".repeat(48);
const otherCustomerToken = "D".repeat(48);
const assignedTechnicianToken = "T".repeat(48);
const otherTechnicianToken = "O".repeat(48);

test("order chat access is scoped and technicians can hand the conversation to an administrator", async (t) => {
  const users = [
    {
      id: "admin-1",
      displayName: "Admin",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: "customer-1",
      displayName: "Customer",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
    {
      id: "customer-2",
      displayName: "Other customer",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: otherCustomerToken,
    },
    {
      id: "tech-1",
      displayName: "Assigned technician",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: assignedTechnicianToken,
    },
    {
      id: "tech-2",
      displayName: "Other technician",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: otherTechnicianToken,
    },
  ];
  const orders = new Map([
    [
      orderId,
      {
        id: orderId,
        customerId: "customer-1",
        assignedTechnicianId: "tech-1",
        deviceType: "LAPTOP",
        problem: "Не включается",
        status: "IN_PROGRESS",
      },
    ],
    [
      otherOrderId,
      {
        id: otherOrderId,
        customerId: "customer-2",
        assignedTechnicianId: "tech-2",
        deviceType: "PHONE",
        problem: "Не заряжается",
        status: "ASSIGNED",
      },
    ],
  ]);
  const conversations = new Map<string, Record<string, any>>();
  const messages: Array<Record<string, any>> = [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const chatDetails = (id: string) => {
    const conversation = conversations.get(id);
    if (!conversation) return null;
    return {
      ...conversation,
      requestedBy: conversation.adminRequestedById
        ? {
            id: conversation.adminRequestedById,
            displayName: userById.get(conversation.adminRequestedById)
              ?.displayName,
          }
        : null,
      joinedBy: conversation.adminJoinedById
        ? {
            id: conversation.adminJoinedById,
            displayName: userById.get(conversation.adminJoinedById)
              ?.displayName,
          }
        : null,
      messages: messages
        .filter((message) => message.chatId === conversation.id)
        .sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .slice(0, 100)
        .map((message) => ({
          ...message,
          sender: message.senderId
            ? {
                id: message.senderId,
                displayName: userById.get(message.senderId)?.displayName,
                role: userById.get(message.senderId)?.role,
              }
            : null,
        })),
    };
  };
  const client = {
    user: {
      findMany: async () =>
        users
          .filter((user) => user.role === "ADMIN" && user.active)
          .map(({ id }) => ({ id })),
    },
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    repairOrder: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        orders.get(where.id) ?? null,
    },
    orderChat: {
      findUnique: async ({ where }: { where: { orderId: string } }) =>
        chatDetails(where.orderId),
      findUniqueOrThrow: async ({ where }: { where: { orderId: string } }) => {
        const chat = chatDetails(where.orderId);
        if (!chat) throw new Error("Chat not found");
        return chat;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { orderId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        let conversation = conversations.get(where.orderId);
        if (!conversation) {
          conversation = {
            id: `chat-${where.orderId}`,
            orderId: where.orderId,
            adminRequestedAt: null,
            adminRequestedById: null,
            adminJoinedAt: null,
            adminJoinedById: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          };
          conversations.set(where.orderId, conversation);
        } else Object.assign(conversation, update);
        return conversation;
      },
      update: async ({
        where,
        data,
      }: {
        where: { orderId: string };
        data: Record<string, unknown>;
      }) => {
        const conversation = conversations.get(where.orderId);
        assert.ok(conversation);
        Object.assign(conversation, data);
        return chatDetails(where.orderId);
      },
      findMany: async () =>
        [...conversations.entries()]
          .filter(([, conversation]) => conversation.adminRequestedAt != null)
          .map(([id, conversation]) => ({
            ...conversation,
            order: orders.get(id),
            requestedBy: userById.get(
              conversation.adminRequestedById as string,
            ),
            joinedBy: userById.get(conversation.adminJoinedById as string),
            messages: messages
              .filter((message) => message.chatId === conversation.id)
              .sort(
                (left, right) =>
                  right.createdAt.getTime() - left.createdAt.getTime(),
              )
              .slice(0, 1)
              .map((message) => ({
                ...message,
                sender: userById.get(message.senderId as string),
              })),
          })),
    },
    orderChatMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const message = {
          id: `message-${messages.length + 1}`,
          createdAt: new Date(),
          ...data,
        };
        messages.push(message);
        return message;
      },
    },
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) =>
      operation(client),
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createChatRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const customerOpen = await fetch(`${baseUrl}/orders/${orderId}/chat`, {
    headers: headers(customerToken),
  });
  assert.equal(customerOpen.status, 200);
  assert.equal((await customerOpen.json()).chat.messages.length, 0);
  const otherCustomerOpen = await fetch(`${baseUrl}/orders/${orderId}/chat`, {
    headers: headers(otherCustomerToken),
  });
  assert.equal(otherCustomerOpen.status, 404);
  const otherTechnicianOpen = await fetch(`${baseUrl}/orders/${orderId}/chat`, {
    headers: headers(otherTechnicianToken),
  });
  assert.equal(otherTechnicianOpen.status, 404);

  const firstMessage = await fetch(
    `${baseUrl}/orders/${orderId}/chat/messages`,
    {
      method: "POST",
      headers: headers(customerToken),
      body: JSON.stringify({
        content: "Здравствуйте, когда можно забрать ноутбук?",
      }),
    },
  );
  assert.equal(firstMessage.status, 201);
  const technicianReply = await fetch(
    `${baseUrl}/orders/${orderId}/chat/messages`,
    {
      method: "POST",
      headers: headers(assignedTechnicianToken),
      body: JSON.stringify({ content: "Проверю и отвечу." }),
    },
  );
  assert.equal(technicianReply.status, 201);

  const requestHelp = await fetch(
    `${baseUrl}/orders/${orderId}/chat/request-admin`,
    {
      method: "POST",
      headers: headers(assignedTechnicianToken),
    },
  );
  assert.equal(requestHelp.status, 200);
  assert.ok((await requestHelp.json()).chat.adminRequestedAt);

  const adminInbox = await fetch(`${baseUrl}/admin/chats`, {
    headers: headers(adminToken),
  });
  assert.equal(adminInbox.status, 200);
  assert.equal((await adminInbox.json()).chats.length, 1);
  const technicianInbox = await fetch(`${baseUrl}/admin/chats`, {
    headers: headers(assignedTechnicianToken),
  });
  assert.equal(technicianInbox.status, 403);

  const adminBeforeJoin = await fetch(
    `${baseUrl}/orders/${orderId}/chat/messages`,
    {
      method: "POST",
      headers: headers(adminToken),
      body: JSON.stringify({ content: "Сообщение до подключения" }),
    },
  );
  assert.equal(adminBeforeJoin.status, 403);

  const joinChat = await fetch(`${baseUrl}/orders/${orderId}/chat/join-admin`, {
    method: "POST",
    headers: headers(adminToken),
  });
  assert.equal(joinChat.status, 200);
  assert.ok((await joinChat.json()).chat.adminJoinedAt);

  const adminMessage = await fetch(
    `${baseUrl}/orders/${orderId}/chat/messages`,
    {
      method: "POST",
      headers: headers(adminToken),
      body: JSON.stringify({ content: "Подключился, помогу с вопросом." }),
    },
  );
  assert.equal(adminMessage.status, 201);

  const customerHistory = await fetch(`${baseUrl}/orders/${orderId}/chat`, {
    headers: headers(customerToken),
  });
  const chat = (await customerHistory.json()).chat;
  assert.equal(chat.messages.length, 3);
  assert.equal(chat.messages.at(-1).sender.role, "ADMIN");
  assert.ok(chat.adminJoinedAt);

  const wrongTechnicianEscalation = await fetch(
    `${baseUrl}/orders/${otherOrderId}/chat/request-admin`,
    {
      method: "POST",
      headers: headers(assignedTechnicianToken),
    },
  );
  assert.equal(wrongTechnicianEscalation.status, 404);

  const customerDirectMessage = await fetch(
    `${baseUrl}/orders/${otherOrderId}/chat/messages`,
    {
      method: "POST",
      headers: headers(otherCustomerToken),
      body: JSON.stringify({
        content: "Подскажите, пожалуйста, статус ремонта.",
      }),
    },
  );
  assert.equal(customerDirectMessage.status, 201);

  const directJoin = await fetch(
    `${baseUrl}/orders/${otherOrderId}/chat/join-admin`,
    { method: "POST", headers: headers(adminToken) },
  );
  assert.equal(directJoin.status, 200);
  assert.ok((await directJoin.json()).chat.adminJoinedAt);

  const directAdminReply = await fetch(
    `${baseUrl}/orders/${otherOrderId}/chat/messages`,
    {
      method: "POST",
      headers: headers(adminToken),
      body: JSON.stringify({
        content: "Заявка в работе, скоро сообщим результат.",
      }),
    },
  );
  assert.equal(directAdminReply.status, 201);

  const directCustomerHistory = await fetch(
    `${baseUrl}/orders/${otherOrderId}/chat`,
    { headers: headers(otherCustomerToken) },
  );
  const directChat = (await directCustomerHistory.json()).chat;
  assert.equal(directChat.messages.length, 2);
  assert.equal(directChat.messages.at(-1).sender.role, "ADMIN");
});
