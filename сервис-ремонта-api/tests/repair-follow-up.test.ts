import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import type { PushNotification } from "../src/features/notifications/push-notifications.js";
import { createRepairFollowUpRouter } from "../src/features/orders/repair-follow-up.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("repair follow-up is private, answered once, and routes help into support chat", async (t) => {
  const ids = {
    admin: "11111111-1111-4111-8111-111111111111",
    customer: "22222222-2222-4222-8222-222222222222",
    otherCustomer: "33333333-3333-4333-8333-333333333333",
    firstOrder: "44444444-4444-4444-8444-444444444444",
    secondOrder: "55555555-5555-4555-8555-555555555555",
  };
  const tokens = { customer: "C".repeat(48), other: "O".repeat(48) };
  const users = [
    {
      id: ids.customer,
      displayName: "Клиент",
      email: "client@example.test",
      login: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.customer,
    },
    {
      id: ids.otherCustomer,
      displayName: "Другой клиент",
      email: "other@example.test",
      login: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.other,
    },
  ];
  const sessions = users.map((user) => ({
    ...user,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const followUps = new Map(
    [
      [ids.firstOrder, ids.customer],
      [ids.secondOrder, ids.otherCustomer],
    ].map(([orderId, customerId], index) => [
      orderId,
      {
        id: `66666666-6666-4666-8666-66666666666${index}`,
        orderId,
        status: "SENT",
        scheduledAt: new Date(Date.now() - 1_000),
        sentAt: new Date(),
        answeredAt: null,
        order: {
          customerId,
          serviceNumber: `SRV-2026-00000${index + 1}`,
          deviceType: "Ноутбук",
          deviceBrand: "Пример",
          deviceModel: "Model 1",
          review: null,
        },
      },
    ]),
  );
  const conversations = new Map<string, { id: string }>();
  const messages: Array<Record<string, unknown>> = [];
  const sentNotifications: Array<{
    recipientIds: readonly string[];
    notification: PushNotification;
  }> = [];

  const findFollowUp = (where: { id?: string; orderId?: string }) =>
    where.orderId
      ? (followUps.get(where.orderId) ?? null)
      : ([...followUps.values()].find((item) => item.id === where.id) ?? null);

  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (item) => hashSessionToken(item.token) === where.tokenHash,
        );
        if (!session) return null;
        const { token: _token, ...user } = session;
        return { expiresAt: session.expiresAt, user };
      },
    },
    repairOrderFollowUp: {
      findUnique: async ({
        where,
      }: {
        where: { id?: string; orderId?: string };
      }) => findFollowUp(where),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => {
        const followUp = findFollowUp({ id: where.id });
        if (!followUp || followUp.status !== where.status) return { count: 0 };
        Object.assign(followUp, data);
        return { count: 1 };
      },
    },
    supportConversation: {
      upsert: async ({ where }: { where: { customerId: string } }) => {
        const conversation = conversations.get(where.customerId) ?? {
          id: "77777777-7777-4777-8777-777777777777",
        };
        conversations.set(where.customerId, conversation);
        return conversation;
      },
    },
    supportChatMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        messages.push(data);
        return data;
      },
    },
    user: {
      findMany: async () => [{ id: ids.admin }],
    },
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) =>
      operation(client),
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createRepairFollowUpRouter(
      client as unknown as DatabaseClient,
      async (_database, recipientIds, notification) => {
        sentNotifications.push({ recipientIds, notification });
        return true;
      },
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders`;

  const privateRead = await fetch(
    `${endpoint}/${ids.secondOrder}/repair-follow-up`,
    {
      headers: { authorization: `Bearer ${tokens.customer}` },
    },
  );
  assert.equal(privateRead.status, 404);

  const workingResponse = await fetch(
    `${endpoint}/${ids.firstOrder}/repair-follow-up`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.customer}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ response: "WORKING" }),
    },
  );
  assert.equal(workingResponse.status, 200);
  assert.equal(
    (
      (await workingResponse.json()) as {
        followUp: { status: string };
      }
    ).followUp.status,
    "WORKING",
  );

  const conflictingResponse = await fetch(
    `${endpoint}/${ids.firstOrder}/repair-follow-up`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.customer}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ response: "NEEDS_HELP" }),
    },
  );
  assert.equal(conflictingResponse.status, 409);

  const helpResponse = await fetch(
    `${endpoint}/${ids.secondOrder}/repair-follow-up`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.other}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ response: "NEEDS_HELP" }),
    },
  );
  assert.equal(helpResponse.status, 200);
  assert.equal(
    (
      (await helpResponse.json()) as {
        followUp: { status: string };
      }
    ).followUp.status,
    "NEEDS_HELP",
  );
  assert.equal(messages.length, 1);
  assert.match(String(messages[0]?.content), /SRV-2026-000002/);
  assert.equal(sentNotifications.length, 1);
  assert.deepEqual(sentNotifications[0]?.recipientIds, [ids.admin]);

  const repeatedHelpResponse = await fetch(
    `${endpoint}/${ids.secondOrder}/repair-follow-up`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${tokens.other}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ response: "NEEDS_HELP" }),
    },
  );
  assert.equal(repeatedHelpResponse.status, 200);
  assert.equal(messages.length, 1);
  assert.equal(sentNotifications.length, 1);
});
