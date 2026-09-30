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
const adminToken = "A".repeat(48);
const assignedTechnicianToken = "T".repeat(48);
const otherTechnicianToken = "O".repeat(48);
const customerToken = "C".repeat(48);

test("only admins and the assigned technician can append order items", async (t) => {
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
    [assignedOrderId, { id: assignedOrderId, assignedTechnicianId: "tech-1" }],
    [unassignedOrderId, { id: unassignedOrderId, assignedTechnicianId: null }],
  ]);
  const items: Array<Record<string, unknown>> = [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const client = {
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
  const addItem = (token: string, orderId: string, name: string) =>
    fetch(`${baseUrl}/api/orders/${orderId}/items`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "SERVICE",
        name,
        quantity: 1,
        unitPriceRub: 1500,
      }),
    });

  const adminAnyOrder = await addItem(
    adminToken,
    unassignedOrderId,
    "Диагностика",
  );
  assert.equal(adminAnyOrder.status, 201);
  assert.equal(
    (await adminAnyOrder.json()).order.items[0].addedBy.displayName,
    "Admin",
  );

  const ownAssignment = await addItem(
    assignedTechnicianToken,
    assignedOrderId,
    "Замена разъёма",
  );
  assert.equal(ownAssignment.status, 201);

  const otherAssignment = await addItem(
    otherTechnicianToken,
    assignedOrderId,
    "Чужая заявка",
  );
  assert.equal(otherAssignment.status, 404);

  const customerAttempt = await addItem(
    customerToken,
    assignedOrderId,
    "Попытка клиента",
  );
  assert.equal(customerAttempt.status, 403);

  const invalidQuantity = await fetch(
    `${baseUrl}/api/orders/${assignedOrderId}/items`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        type: "SPARE_PART",
        name: "SSD",
        quantity: 0,
        unitPriceRub: 8000,
      }),
    },
  );
  assert.equal(invalidQuantity.status, 400);
  assert.equal(items.length, 2);
});
