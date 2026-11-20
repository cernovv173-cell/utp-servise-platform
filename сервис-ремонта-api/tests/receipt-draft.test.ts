import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("receipt edits synchronize stock, service-only bonus discount and technician pay", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const serviceItemId = "22222222-2222-4222-8222-222222222222";
  const partItemId = "33333333-3333-4333-8333-333333333333";
  const sparePartId = "44444444-4444-4444-8444-444444444444";
  const adminId = "55555555-5555-4555-8555-555555555555";
  const technicianId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const salaryEntryId = "66666666-6666-4666-8666-666666666666";
  const token = "T".repeat(48);
  const adminToken = "A".repeat(48);
  const technician = {
    id: technicianId,
    email: "technician@example.test",
    displayName: "Мастер",
    role: "TECHNICIAN" as const,
    active: true,
    mustChangePassword: false,
  };
  const admin = {
    id: adminId,
    email: "admin@example.test",
    displayName: "Admin",
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  const items: Array<Record<string, unknown>> = [
    {
      id: serviceItemId,
      orderId,
      catalogItemId: null,
      type: "SERVICE",
      name: "Диагностика",
      quantity: 1,
      unitPriceRub: 200,
      addedById: adminId,
    },
    {
      id: partItemId,
      orderId,
      catalogItemId: sparePartId,
      type: "SPARE_PART",
      name: "Память",
      quantity: 1,
      unitPriceRub: 300,
      addedById: adminId,
    },
  ];
  let stockQuantity = 2;
  let savedReceipt: Record<string, unknown> | undefined;
  let savedSalary: Record<string, unknown> | undefined;
  let bonusDiscountRub = 0;
  const databaseClient = {
    $queryRaw: async () => [],
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: technician }
          : where.tokenHash === hashSessionToken(adminToken)
            ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
            : null,
    },
    repairOrder: {
      findUnique: async ({ include }: { include?: Record<string, unknown> }) =>
        include
          ? {
              id: orderId,
              serviceNumber: "SRV-2026-000001",
              customerId: "77777777-7777-4777-8777-777777777777",
              assignedTechnicianId: technicianId,
              status: "COMPLETED",
              contactPhone: null,
              redeemBonuses: true,
              items: [...items],
              customer: { displayName: "Клиент", phoneNumber: null },
              receipt: {
                id: "88888888-8888-4888-8888-888888888888",
                paymentStatus: "PENDING",
              },
              salaryEntry: { id: salaryEntryId, ratePercent: 40 },
            }
          : {
              id: orderId,
              customerId: "77777777-7777-4777-8777-777777777777",
              assignedTechnicianId: technicianId,
            },
      update: async ({ data }: { data: { bonusDiscountRub: number } }) => {
        bonusDiscountRub = data.bonusDiscountRub;
        return data;
      },
    },
    repairOrderItem: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { quantity: number };
      }) => {
        const item = items.find((entry) => entry.id === where.id);
        assert.ok(item);
        item.quantity = data.quantity;
        return item;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = items.findIndex((entry) => entry.id === where.id);
        assert.notEqual(index, -1);
        return items.splice(index, 1)[0];
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const item = { id: "99999999-9999-4999-8999-999999999999", ...data };
        items.push(item);
        return item;
      },
    },
    repairCatalogItem: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; stockQuantity?: { gte: number } };
        data: {
          stockQuantity: { decrement: number } | { increment: number };
        };
      }) => {
        if (where.id !== sparePartId) return { count: 0 };
        if ("increment" in data.stockQuantity) {
          stockQuantity += data.stockQuantity.increment;
          return { count: 1 };
        }
        if (where.stockQuantity && stockQuantity < where.stockQuantity.gte) {
          return { count: 0 };
        }
        stockQuantity -= data.stockQuantity.decrement;
        return { count: 1 };
      },
    },
    loyaltyTransaction: {
      aggregate: async () => ({ _sum: { points: 1000 } }),
    },
    technicianSalaryEntry: {
      update: async ({ data }: { data: Record<string, unknown> }) => {
        savedSalary = data;
        return data;
      },
    },
    repairReceipt: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        savedReceipt = { id: where.id, paymentStatus: "PENDING", ...data };
        return savedReceipt;
      },
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

  const adminAttempt = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/${orderId}/receipt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ itemQuantities: [] }),
    },
  );
  assert.equal(adminAttempt.status, 403);

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/${orderId}/receipt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        itemQuantities: [
          { itemId: serviceItemId, quantity: 2 },
          { itemId: partItemId, quantity: 2 },
        ],
        freeSaleItems: [
          {
            type: "SERVICE",
            name: "Выезд",
            quantity: 1,
            unitPriceRub: 100,
          },
        ],
      }),
    },
  );

  assert.equal(response.status, 201);
  assert.equal(stockQuantity, 1);
  assert.equal(bonusDiscountRub, 150);
  assert.equal(savedReceipt?.totalRub, 1100);
  assert.equal(savedReceipt?.bonusDiscountRub, 150);
  assert.equal(savedSalary?.serviceTotalRub, 500);
  assert.equal(savedSalary?.salaryRub, 200);
  assert.deepEqual(
    (savedReceipt?.itemsSnapshot as Array<{ quantity: number }>).map(
      (item) => item.quantity,
    ),
    [2, 2, 1],
  );

  const removalResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/${orderId}/receipt`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        itemQuantities: [
          { itemId: serviceItemId, quantity: 2 },
          { itemId: partItemId, quantity: 0 },
        ],
      }),
    },
  );

  assert.equal(removalResponse.status, 201);
  assert.equal(stockQuantity, 3);
  assert.equal(savedReceipt?.totalRub, 500);
  assert.equal(savedReceipt?.bonusDiscountRub, 150);
  assert.equal(savedSalary?.serviceTotalRub, 500);
  assert.equal(savedSalary?.salaryRub, 200);
  assert.equal(
    items.some((item) => item.id === partItemId),
    false,
  );
  assert.deepEqual(
    (savedReceipt?.itemsSnapshot as Array<{ quantity: number }>).map(
      (item) => item.quantity,
    ),
    [2, 1],
  );
});
