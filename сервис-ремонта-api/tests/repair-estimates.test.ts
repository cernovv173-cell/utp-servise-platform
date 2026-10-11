import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import { createRepairEstimatesRouter } from "../src/features/orders/repair-estimates.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("repair estimate defers stock use until approval and blocks bypass", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const catalogItemId = "22222222-2222-4222-8222-222222222222";
  const estimateId = "33333333-3333-4333-8333-333333333333";
  const adminId = "44444444-4444-4444-8444-444444444444";
  const technicianId = "55555555-5555-4555-8555-555555555555";
  const customerId = "66666666-6666-4666-8666-666666666666";
  const adminToken = "A".repeat(48);
  const technicianToken = "T".repeat(48);
  const customerToken = "C".repeat(48);
  const users = [
    {
      id: adminId,
      email: "admin@example.test",
      displayName: "Администратор",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
    },
    {
      id: technicianId,
      email: "tech@example.test",
      displayName: "Мастер",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
    },
    {
      id: customerId,
      email: "customer@example.test",
      displayName: "Клиент",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
    },
  ];
  const tokens = new Map([
    [hashSessionToken(adminToken), users[0]!],
    [hashSessionToken(technicianToken), users[1]!],
    [hashSessionToken(customerToken), users[2]!],
  ]);
  const order = {
    id: orderId,
    customerId,
    assignedTechnicianId: technicianId,
    serviceNumber: "S-100",
    status: "ASSIGNED",
    receipt: null,
  };
  const catalogItem = {
    id: catalogItemId,
    type: "SPARE_PART",
    name: "Экран",
    unitPriceRub: 12500,
    stockQuantity: 5,
    active: true,
  };
  let stockQuantity = 5;
  let estimate: Record<string, unknown> | null = null;
  const orderItems: Array<Record<string, unknown>> = [];
  const client = {
    $queryRaw: async () => [],
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = tokens.get(where.tokenHash);
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    user: { findMany: async () => [] },
    pushDeviceToken: { findMany: async () => [] },
    repairOrder: {
      findUnique: async () => ({
        ...order,
        estimates: estimate ? [estimate] : [],
      }),
      findUniqueOrThrow: async () => ({ ...order, items: orderItems }),
      updateMany: async ({ data }: { data: { status: string } }) => {
        order.status = data.status;
        return { count: 1 };
      },
    },
    repairCatalogItem: {
      findMany: async () => [catalogItem],
      findUnique: async () => ({
        id: catalogItem.id,
        type: catalogItem.type,
        stockQuantity,
      }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; stockQuantity?: { gte: number } };
        data: { stockQuantity: { decrement: number } };
      }) => {
        if (
          where.id !== catalogItemId ||
          (where.stockQuantity && stockQuantity < where.stockQuantity.gte)
        ) {
          return { count: 0 };
        }
        stockQuantity -= data.stockQuantity.decrement;
        return { count: 1 };
      },
    },
    repairOrderItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const item = { id: `line-${orderItems.length + 1}`, ...data };
        orderItems.push(item);
        return item;
      },
    },
    repairEstimate: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        estimate = {
          id: estimateId,
          ...data,
          createdBy: { id: adminId, displayName: "Администратор" },
        };
        return estimate;
      },
      findFirst: async ({
        where,
      }: {
        where: { id?: string; orderId: string; status?: string };
      }) =>
        estimate &&
        where.orderId === orderId &&
        (!where.id || where.id === estimate.id) &&
        (!where.status || where.status === estimate.status)
          ? estimate
          : null,
      updateMany: async ({
        where,
        data,
      }: {
        where: { id?: string; orderId: string; status?: string };
        data: Record<string, unknown>;
      }) => {
        if (
          !estimate ||
          where.orderId !== orderId ||
          (where.id && where.id !== estimate.id) ||
          (where.status && where.status !== estimate.status)
        ) {
          return { count: 0 };
        }
        Object.assign(estimate, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => estimate,
    },
    repairStatusEvent: { create: async () => ({ createdAt: new Date() }) },
    repairOrderIntake: { findUnique: async () => null },
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) =>
      operation(client),
  };
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.log = {
      error: (details, message) => console.error(message, details),
    } as typeof request.log;
    next();
  });
  app.use(
    "/api",
    createRepairEstimatesRouter(client as unknown as DatabaseClient),
    createOrdersRouter(client as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/orders/${orderId}`;

  const submitted = await fetch(`${baseUrl}/estimates`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      diagnosis: "Требуется заменить экран.",
      items: [{ catalogItemId, quantity: 2 }],
    }),
  });
  assert.equal(submitted.status, 201);
  const responseBody = (await submitted.json()) as {
    estimate: { id: string; totalRub: number; itemsSnapshot: unknown };
  };
  assert.equal(responseBody.estimate.totalRub, 25000);
  assert.deepEqual(responseBody.estimate.itemsSnapshot, [
    {
      catalogItemId,
      type: "SPARE_PART",
      name: "Экран",
      quantity: 2,
      unitPriceRub: 12500,
    },
  ]);
  assert.equal(stockQuantity, 5);
  assert.equal(orderItems.length, 0);

  const bypass = await fetch(`${baseUrl}/items`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${technicianToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ catalogItemId, quantity: 1 }),
  });
  assert.equal(bypass.status, 409);
  assert.equal(stockQuantity, 5);

  const prematureStart = await fetch(`${baseUrl}/status`, {
    method: "PATCH",
    headers: {
      authorization: `Bearer ${technicianToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ status: "IN_PROGRESS" }),
  });
  assert.equal(prematureStart.status, 409);
  assert.equal(order.status, "ASSIGNED");

  const approved = await fetch(
    `${baseUrl}/estimates/${responseBody.estimate.id}/response`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${customerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ decision: "APPROVED" }),
    },
  );
  assert.equal(approved.status, 200);
  assert.equal(stockQuantity, 3);
  assert.equal(orderItems.length, 1);
  assert.equal(orderItems[0]?.unitPriceRub, 12500);
  assert.equal(orderItems[0]?.quantity, 2);
});
