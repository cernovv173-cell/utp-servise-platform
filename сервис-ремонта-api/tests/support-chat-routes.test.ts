import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createSupportChatRouter } from "../src/features/support-chat/support-chat.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("customer support conversations are private to the customer and available to administrators", async (t) => {
  const ids = {
    admin: "11111111-1111-4111-8111-111111111111",
    customer: "22222222-2222-4222-8222-222222222222",
    otherCustomer: "33333333-3333-4333-8333-333333333333",
  };
  const tokens = {
    admin: "A".repeat(48),
    customer: "C".repeat(48),
    other: "O".repeat(48),
  };
  const users = [
    {
      id: ids.admin,
      displayName: "Администратор",
      email: "admin@example.test",
      phoneNumber: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.admin,
    },
    {
      id: ids.customer,
      displayName: "Клиент",
      email: "client@example.test",
      phoneNumber: "+7 999 000-00-00",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.customer,
    },
    {
      id: ids.otherCustomer,
      displayName: "Другой клиент",
      email: "other@example.test",
      phoneNumber: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.other,
    },
  ];
  const byId = new Map(users.map((user) => [user.id, user]));
  const sessions = users.map((user) => ({
    ...user,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const conversations = new Map<string, Record<string, any>>();
  const messages: Array<Record<string, any>> = [];

  const getChat = (customerId: string) => {
    const conversation = conversations.get(customerId);
    if (!conversation) return null;
    return {
      ...conversation,
      customer: byId.get(customerId),
      messages: messages
        .filter((message) => message.chatId === conversation.id)
        .sort(
          (left, right) => right.createdAt.getTime() - left.createdAt.getTime(),
        )
        .slice(0, 100)
        .map((message) => ({
          ...message,
          sender: byId.get(message.senderId) ?? null,
        })),
    };
  };
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        if (!session) return null;
        const { token: _token, ...user } = session;
        return { expiresAt: session.expiresAt, user };
      },
    },
    user: {
      findMany: async () =>
        users
          .filter((user) => user.role === "ADMIN" && user.active)
          .map(({ id }) => ({ id })),
      findFirst: async ({ where }: { where: { id: string; role: string } }) => {
        const user = byId.get(where.id);
        return user?.role === where.role ? { id: user.id } : null;
      },
    },
    supportConversation: {
      findUnique: async ({ where }: { where: { customerId: string } }) =>
        getChat(where.customerId),
      findUniqueOrThrow: async ({
        where,
      }: {
        where: { customerId: string };
      }) => {
        const chat = getChat(where.customerId);
        if (!chat) throw new Error("Support conversation not found");
        return chat;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { customerId: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        let conversation = conversations.get(where.customerId);
        if (!conversation) {
          conversation = {
            id: "44444444-4444-4444-8444-444444444444",
            createdAt: new Date(),
            ...create,
          };
          conversations.set(where.customerId, conversation);
        } else Object.assign(conversation, update);
        return { id: conversation.id };
      },
      findMany: async () =>
        [...conversations.entries()].map(([customerId, conversation]) => ({
          ...conversation,
          customer: byId.get(customerId),
          messages: messages
            .filter((message) => message.chatId === conversation.id)
            .slice(-1)
            .reverse()
            .map((message) => ({
              ...message,
              sender: byId.get(message.senderId) ?? null,
            })),
        })),
      update: async ({
        where,
        data,
      }: {
        where: { customerId: string };
        data: Record<string, unknown>;
      }) => {
        const conversation = conversations.get(where.customerId);
        assert.ok(conversation);
        Object.assign(conversation, data);
        return conversation;
      },
    },
    supportChatMessage: {
      create: async ({ data }: { data: Record<string, any> }) => {
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
  app.use("/api", createSupportChatRouter(client as unknown as DatabaseClient));
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

  const empty = await fetch(`${baseUrl}/support/chat`, {
    headers: headers(tokens.customer),
  });
  assert.equal(empty.status, 200);
  assert.deepEqual((await empty.json()).chat.messages, []);

  const sent = await fetch(`${baseUrl}/support/chat/messages`, {
    method: "POST",
    headers: headers(tokens.customer),
    body: JSON.stringify({ content: "Здравствуйте, нужна консультация." }),
  });
  assert.equal(sent.status, 201);
  assert.equal((await sent.json()).chat.messages.length, 1);

  const inbox = await fetch(`${baseUrl}/admin/support/chats`, {
    headers: headers(tokens.admin),
  });
  assert.equal(inbox.status, 200);
  assert.equal((await inbox.json()).chats[0].customer.id, ids.customer);

  const reply = await fetch(
    `${baseUrl}/admin/support/chats/${ids.customer}/messages`,
    {
      method: "POST",
      headers: headers(tokens.admin),
      body: JSON.stringify({
        content: "Здравствуйте, подскажите, пожалуйста.",
      }),
    },
  );
  assert.equal(reply.status, 201);

  const history = await fetch(`${baseUrl}/support/chat`, {
    headers: headers(tokens.customer),
  });
  assert.deepEqual(
    (await history.json()).chat.messages.map(
      (message: { senderRole?: string; sender?: { role: string } }) =>
        message.sender?.role,
    ),
    ["CUSTOMER", "ADMIN"],
  );

  const otherCustomerAccess = await fetch(`${baseUrl}/admin/support/chats`, {
    headers: headers(tokens.other),
  });
  assert.equal(otherCustomerAccess.status, 403);
  const administratorInCustomerPortal = await fetch(`${baseUrl}/support/chat`, {
    headers: headers(tokens.admin),
  });
  assert.equal(administratorInCustomerPortal.status, 403);
});
