import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("tracked spare parts are decremented on add and restored on removal", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const catalogItemId = "22222222-2222-4222-8222-222222222222";
  const orderItemId = "33333333-3333-4333-8333-333333333333";
  const adminId = "44444444-4444-4444-8444-444444444444";
  const token = "A".repeat(48);
  const admin = {
    id: adminId,
    email: "admin@example.test",
    displayName: "Admin",
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  let stockQuantity = 3;
  let orderStatus = "IN_PROGRESS";
  const items: Array<Record<string, unknown>> = [];
  const databaseClient = {
    $queryRaw: async () => [],
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    repairOrder: {
      findUnique: async () => ({
        id: orderId,
        assignedTechnicianId: null,
        status: orderStatus,
      }),
      updateMany: async ({ data }: { data: { status: string } }) => {
        orderStatus = data.status;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        id: orderId,
        assignedTechnicianId: null,
        status: orderStatus,
        items: [...items],
      }),
    },
    repairCatalogItem: {
      findFirst: async () => ({
        id: catalogItemId,
        type: "SPARE_PART",
        name: "Тестовая запчасть",
        unitPriceRub: 250,
        stockQuantity,
      }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; stockQuantity?: { gte: number } };
        data: { stockQuantity: { decrement?: number; increment?: number } };
      }) => {
        if (where.id !== catalogItemId) return { count: 0 };
        if (
          where.stockQuantity?.gte !== undefined &&
          stockQuantity < where.stockQuantity.gte
        ) {
          return { count: 0 };
        }
        stockQuantity +=
          (data.stockQuantity.increment ?? 0) -
          (data.stockQuantity.decrement ?? 0);
        return { count: 1 };
      },
    },
    repairOrderItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const item = { id: orderItemId, ...data };
        items.push(item);
        return item;
      },
      findFirst: async () => items[0] ?? null,
      findMany: async () =>
        items.filter(
          (item) => item.type === "SPARE_PART" && item.catalogItemId,
        ),
      delete: async () => {
        const [item] = items.splice(0, 1);
        return item;
      },
    },
    repairStatusEvent: {
      create: async () => ({ createdAt: new Date() }),
    },
    $transaction: async <T>(operation: (client: unknown) => Promise<T>) =>
      operation(databaseClient),
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createOrdersRouter(databaseClient as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/orders/${orderId}/items`;
  const addItem = (quantity: number) =>
    fetch(baseUrl, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ catalogItemId, quantity }),
    });

  const added = await addItem(2);
  assert.equal(added.status, 201);
  assert.equal(stockQuantity, 1);

  const overdrawn = await addItem(2);
  assert.equal(overdrawn.status, 409);
  assert.equal(stockQuantity, 1);
  assert.equal(items.length, 1);

  const removed = await fetch(`${baseUrl}/${orderItemId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(removed.status, 200);
  assert.equal(stockQuantity, 3);
  assert.equal(items.length, 0);

  const reserved = await addItem(2);
  assert.equal(reserved.status, 201);
  assert.equal(stockQuantity, 1);
  const cancelled = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/${orderId}/status`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "CANCELLED" }),
    },
  );
  assert.equal(cancelled.status, 200);
  assert.equal(orderStatus, "CANCELLED");
  assert.equal(stockQuantity, 3);
});
