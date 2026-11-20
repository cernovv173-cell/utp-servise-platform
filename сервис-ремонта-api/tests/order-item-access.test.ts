import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const assignedOrderId = "11111111-1111-4111-8111-111111111111";
const unassignedOrderId = "22222222-2222-4222-8222-222222222222";
const catalogEntryId = "33333333-3333-4333-8333-333333333333";
const adminToken = "A".repeat(48);
const assignedTechnicianToken = "T".repeat(48);
const otherTechnicianToken = "O".repeat(48);
const customerToken = "C".repeat(48);

test("only the assigned technician can append order items", async (t) => {
  const users = [
    {
      id: "admin-1",
      email: "admin@test.invalid",
      displayName: "Admin",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: "tech-1",
      email: "tech@test.invalid",
      displayName: "Assigned",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: assignedTechnicianToken,
    },
    {
      id: "tech-2",
      email: "other@test.invalid",
      displayName: "Other",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: otherTechnicianToken,
    },
    {
      id: "customer-1",
      email: "customer@test.invalid",
      displayName: "Customer",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
  ];
  const orders = new Map([
    [
      assignedOrderId,
      {
        id: assignedOrderId,
        assignedTechnicianId: "tech-1",
        deviceType: "COMPUTER",
      },
    ],
    [
      unassignedOrderId,
      {
        id: unassignedOrderId,
        assignedTechnicianId: null,
        deviceType: "COMPUTER",
      },
    ],
  ]);
  const items: Array<Record<string, unknown>> = [];
  const catalog = [
    {
      id: catalogEntryId,
      type: "SERVICE",
      name: "Диагностика",
      unitPriceRub: 1800,
      deviceTypes: ["COMPUTER"],
      active: true,
    },
  ];
  const userById = new Map(users.map((user) => [user.id, user]));
  const client = {
    $queryRaw: async () => [],
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
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const order = orders.get(where.id);
        if (!order) throw new Error("Order not found");
        return {
          ...order,
          items: items
            .filter((item) => item.orderId === where.id)
            .map((item) => ({
              ...item,
              addedBy: {
                id: item.addedById,
                displayName: userById.get(item.addedById as string)
                  ?.displayName,
              },
            })),
        };
      },
    },
    repairOrderItem: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const item = {
          id: `item-${items.length + 1}`,
          ...data,
          createdAt: new Date(),
        };
        items.push(item);
        return item;
      },
    },
    repairEstimate: { findFirst: async () => null },
    repairCatalogItem: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; active: boolean };
      }) => catalog.find((item) => item.id === where.id && item.active) ?? null,
    },
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) =>
      operation(client),
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createOrdersRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;
  const addItem = (
    token: string,
    orderId: string,
    body: Record<string, unknown> = {},
  ) =>
    fetch(`${baseUrl}/api/orders/${orderId}/items`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        catalogItemId: catalogEntryId,
        quantity: 1,
        ...body,
      }),
    });

  const adminAnyOrder = await addItem(adminToken, unassignedOrderId);
  assert.equal(adminAnyOrder.status, 403);
  assert.equal(items.length, 0);

  const ownAssignment = await addItem(assignedTechnicianToken, assignedOrderId);
  assert.equal(ownAssignment.status, 201);

  const otherAssignment = await addItem(otherTechnicianToken, assignedOrderId);
  assert.equal(otherAssignment.status, 404);

  const customerAttempt = await addItem(customerToken, assignedOrderId);
  assert.equal(customerAttempt.status, 403);

  const invalidQuantity = await fetch(
    `${baseUrl}/api/orders/${assignedOrderId}/items`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${assignedTechnicianToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        catalogItemId: catalogEntryId,
        quantity: 0,
      }),
    },
  );
  assert.equal(invalidQuantity.status, 400);
  assert.equal(items.length, 1);

  const priceSpoof = await addItem(assignedTechnicianToken, assignedOrderId, {
    name: "Другая позиция",
    unitPriceRub: 1,
  });
  assert.equal(priceSpoof.status, 400);
  assert.equal(items.length, 1);

  catalog[0]!.active = false;
  const disabledEntry = await addItem(assignedTechnicianToken, assignedOrderId);
  assert.equal(disabledEntry.status, 404);
  assert.equal(items.length, 1);
});
