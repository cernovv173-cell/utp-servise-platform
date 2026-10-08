import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("customers can edit only their own new orders; administrators can edit orders in any status", async (t) => {
  const tokens = {
    owner: "O".repeat(48),
    otherCustomer: "C".repeat(48),
    admin: "A".repeat(48),
  };
  const order = {
    id: "44444444-4444-4444-8444-444444444444",
    customerId: "11111111-1111-4111-8111-111111111111",
    assignedTechnicianId: "33333333-3333-4333-8333-333333333333" as
      string | null,
    deviceType: "LAPTOP",
    problem: "Не включается ноутбук",
    address: "Москва, улица Тестовая, 1",
    preferredAt: null as Date | null,
    status: "REQUESTED" as
      | "REQUESTED"
      | "ASSIGNED"
      | "IN_PROGRESS"
      | "READY_FOR_PICKUP"
      | "COMPLETED"
      | "CANCELLED",
    updatedAt: new Date(),
  };
  const users = [
    {
      id: order.customerId,
      email: "owner@example.test",
      displayName: "Заказчик",
      phoneNumber: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.owner,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "other@example.test",
      displayName: "Другой клиент",
      phoneNumber: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.otherCustomer,
    },
    {
      id: "55555555-5555-4555-8555-555555555555",
      email: "admin@example.test",
      displayName: "Администратор",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.admin,
    },
  ];
  const changes: Array<Record<string, unknown>> = [];
  const transaction = {
    repairOrder: {
      findUnique: async () => ({ ...order }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { status: string; updatedAt: Date };
        data: Record<string, unknown>;
      }) => {
        if (
          where.status !== order.status ||
          where.updatedAt !== order.updatedAt
        ) {
          return { count: 0 };
        }
        changes.push(data);
        Object.assign(order, data, { updatedAt: new Date() });
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        ...order,
        customer: {
          displayName: "Заказчик",
          phoneNumber: null,
          avatarObjectId: null,
        },
        assignedTechnician: {
          displayName: "Мастер",
          phoneNumber: null,
          avatarObjectId: null,
        },
        statusEvents: [],
        items: [],
        photos: [],
        review: null,
      }),
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    $transaction: async (callback: (value: typeof transaction) => unknown) =>
      callback(transaction),
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders/${order.id}`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const edited = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.owner),
    body: JSON.stringify({ problem: "Экран ноутбука не включается" }),
  });
  assert.equal(edited.status, 200);
  assert.equal(
    (await edited.json()).order.problem,
    "Экран ноутбука не включается",
  );

  const otherUser = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.otherCustomer),
    body: JSON.stringify({ address: "Санкт-Петербург, улица Новая, 10" }),
  });
  assert.equal(otherUser.status, 404);

  order.status = "ASSIGNED";
  const customerAfterAssignment = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.owner),
    body: JSON.stringify({ problem: "Изменение после назначения" }),
  });
  assert.equal(customerAfterAssignment.status, 409);

  const adminEdit = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.admin),
    body: JSON.stringify({ address: "Москва, улица Новая, 10" }),
  });
  assert.equal(adminEdit.status, 200);
  assert.equal(changes.length, 2);

  order.status = "IN_PROGRESS";
  for (const status of [
    "IN_PROGRESS",
    "READY_FOR_PICKUP",
    "COMPLETED",
    "CANCELLED",
  ] as const) {
    order.status = status;
    const adminEdit = await fetch(endpoint, {
      method: "PATCH",
      headers: headers(tokens.admin),
      body: JSON.stringify({ problem: `Исправление данных статуса ${status}` }),
    });
    assert.equal(adminEdit.status, 200);
    assert.equal(
      (await adminEdit.json()).order.problem,
      `Исправление данных статуса ${status}`,
    );
  }
  assert.equal(changes.length, 6);
});
