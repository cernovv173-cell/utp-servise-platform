import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createChatRouter } from "../src/features/chat/chat.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("repair chat unread state is private to each administrator and clears through the read message", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const chatId = "22222222-2222-4222-8222-222222222222";
  const firstAdminId = "33333333-3333-4333-8333-333333333333";
  const secondAdminId = "44444444-4444-4444-8444-444444444444";
  const customerId = "55555555-5555-4555-8555-555555555555";
  const users = [
    {
      id: firstAdminId,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: "A".repeat(48),
    },
    {
      id: secondAdminId,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: "B".repeat(48),
    },
    {
      id: customerId,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: "C".repeat(48),
    },
  ];
  const createdAt = new Date("2026-10-08T18:00:00.000Z");
  const message = {
    id: "66666666-6666-4666-8666-666666666666",
    chatId,
    senderId: customerId,
    content: "Подскажите, когда будет готов ноутбук?",
    createdAt,
    sender: { displayName: "Клиент", role: "CUSTOMER" },
  };
  const readReceipts = new Map<string, { lastReadAt: Date }>();
  const receiptKey = (adminId: string) => `${chatId}:${adminId}`;
  const conversation = {
    id: chatId,
    orderId,
    adminRequestedAt: null,
    adminRequestedById: null,
    adminJoinedAt: null,
    adminJoinedById: null,
    messages: [message],
  };
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        if (!user) return null;
        const { token: _token, ...sessionUser } = user;
        return { expiresAt: new Date(Date.now() + 60_000), user: sessionUser };
      },
    },
    repairOrder: {
      findUnique: async () => ({ customerId, assignedTechnicianId: null }),
    },
    orderChat: {
      findMany: async (input: {
        select: { adminReadReceipts: { where: { adminId: string } } };
      }) => [
        {
          orderId,
          adminReadReceipts: readReceipts.has(
            receiptKey(input.select.adminReadReceipts.where.adminId),
          )
            ? [
                readReceipts.get(
                  receiptKey(input.select.adminReadReceipts.where.adminId),
                ),
              ]
            : [],
          order: {
            serviceNumber: "SRV-2026-000001",
            customer: { displayName: "Клиент" },
          },
          messages: [message],
        },
      ],
      findUnique: async ({ where }: { where: { orderId: string } }) =>
        where.orderId === orderId ? { id: chatId } : null,
    },
    orderChatMessage: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; chatId: string };
      }) =>
        where.id === message.id && where.chatId === chatId
          ? { createdAt }
          : null,
    },
    orderChatAdminRead: {
      findUnique: async ({
        where,
      }: {
        where: { chatId_adminId: { adminId: string } };
      }) => readReceipts.get(receiptKey(where.chatId_adminId.adminId)) ?? null,
      create: async ({
        data,
      }: {
        data: { adminId: string; lastReadAt: Date };
      }) => {
        const receipt = { lastReadAt: data.lastReadAt };
        readReceipts.set(receiptKey(data.adminId), receipt);
        return receipt;
      },
      update: async ({
        where,
        data,
      }: {
        where: { chatId_adminId: { adminId: string } };
        data: { lastReadAt: Date };
      }) => {
        const receipt = { lastReadAt: data.lastReadAt };
        readReceipts.set(receiptKey(where.chatId_adminId.adminId), receipt);
        return receipt;
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
  const firstAdmin = users[0]!;
  const secondAdmin = users[1]!;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const firstUnread = await fetch(`${baseUrl}/admin/chat-notifications`, {
    headers: headers(firstAdmin.token),
  });
  assert.equal(firstUnread.status, 200);
  assert.equal((await firstUnread.json()).totalUnread, 1);

  const secondUnread = await fetch(`${baseUrl}/admin/chat-notifications`, {
    headers: headers(secondAdmin.token),
  });
  assert.equal(secondUnread.status, 200);
  assert.equal((await secondUnread.json()).totalUnread, 1);

  const markedRead = await fetch(`${baseUrl}/orders/${orderId}/chat/read`, {
    method: "POST",
    headers: headers(firstAdmin.token),
    body: JSON.stringify({ messageId: message.id }),
  });
  assert.equal(markedRead.status, 204);

  const firstAfterRead = await fetch(`${baseUrl}/admin/chat-notifications`, {
    headers: headers(firstAdmin.token),
  });
  assert.equal((await firstAfterRead.json()).totalUnread, 0);
  const secondStillUnread = await fetch(`${baseUrl}/admin/chat-notifications`, {
    headers: headers(secondAdmin.token),
  });
  assert.equal((await secondStillUnread.json()).totalUnread, 1);

  const customerReadAttempt = await fetch(
    `${baseUrl}/orders/${orderId}/chat/read`,
    {
      method: "POST",
      headers: headers(users[2]!.token),
      body: JSON.stringify({ messageId: message.id }),
    },
  );
  assert.equal(customerReadAttempt.status, 403);

  const wrongChatMessage = await fetch(
    `${baseUrl}/orders/${orderId}/chat/read`,
    {
      method: "POST",
      headers: headers(firstAdmin.token),
      body: JSON.stringify({
        messageId: "77777777-7777-4777-8777-777777777777",
      }),
    },
  );
  assert.equal(wrongChatMessage.status, 404);
});
