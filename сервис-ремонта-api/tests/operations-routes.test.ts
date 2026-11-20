import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOperationsRouter } from "../src/features/operations/operations.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "A".repeat(48);
const customerToken = "C".repeat(48);
const procurementToken = "P".repeat(48);
const technicianToken = "T".repeat(48);
const orderId = "33333333-3333-4333-8333-333333333334";
const partId = "33333333-3333-4333-8333-333333333335";

test("admin operations expose schedule, procurement and a bounded dashboard", async (t) => {
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
      id: "customer-1",
      email: "customer@test.invalid",
      displayName: "Customer",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
    {
      id: "buyer-1",
      email: "buyer@test.invalid",
      displayName: "Buyer",
      role: "PROCUREMENT" as const,
      active: true,
      mustChangePassword: false,
      token: procurementToken,
    },
    {
      id: "tech-1",
      email: "tech@test.invalid",
      displayName: "Technician",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: technicianToken,
    },
  ];
  const updates: Array<{ id: string; data: Record<string, unknown> }> = [];
  const order = {
    id: orderId,
    serviceNumber: "SRV-2026-000001",
    deviceType: "LAPTOP",
    deviceBrand: "Lenovo",
    deviceModel: "ThinkPad",
    problem: "Не включается",
    city: "Москва",
    street: "Тестовая",
    house: "1",
    preferredAt: new Date("2026-10-20T10:00:00.000Z"),
    expectedCompletionAt: null,
    status: "REQUESTED",
    priority: "NORMAL",
    assignedTechnicianId: null as string | null,
    customer: { displayName: "Клиент" },
    assignedTechnician: null,
  };
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
      findMany: async () => [order],
      count: async () => 2,
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          status?: string | { in: string[] };
          assignedTechnicianId?: string;
        };
        data: Record<string, unknown>;
      }) => {
        if (
          where.id !== order.id ||
          (where.status &&
            (typeof where.status === "string"
              ? where.status !== order.status
              : !where.status.in.includes(order.status))) ||
          (where.assignedTechnicianId &&
            where.assignedTechnicianId !== "tech-1")
        ) {
          return { count: 0 };
        }
        updates.push({ id: where.id, data });
        order.priority = data.priority as string;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        id: order.id,
        priority: order.priority,
      }),
    },
    repairCatalogItem: {
      findMany: async () => [
        {
          id: partId,
          name: "Аккумулятор",
          stockQuantity: 1,
          minimumStockQuantity: 3,
          unitPriceRub: 4000,
        },
        {
          id: "33333333-3333-4333-8333-333333333336",
          name: "Кабель",
          stockQuantity: 9,
          minimumStockQuantity: 3,
          unitPriceRub: 500,
        },
      ],
    },
    repairOrderItem: {
      findMany: async () => [{ catalogItemId: partId, quantity: 2 }],
    },
    repairStatusEvent: {
      findMany: async () => [
        {
          createdAt: new Date("2026-10-10T12:00:00.000Z"),
          order: {
            createdAt: new Date("2026-10-10T10:00:00.000Z"),
            items: [{ name: "Диагностика", quantity: 1 }],
          },
        },
      ],
    },
    repairReceipt: {
      findMany: async () => [{ totalRub: 5000, bonusDiscountRub: 500 }],
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createOperationsRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/admin/operations`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });

  const schedule = await fetch(
    `${baseUrl}/calendar?from=2026-10-19T00%3A00%3A00.000Z&to=2026-10-21T00%3A00%3A00.000Z`,
    { headers: headers(adminToken) },
  );
  assert.equal(schedule.status, 200);
  assert.equal((await schedule.json()).orders[0].deviceBrand, "Lenovo");

  const forbidden = await fetch(`${baseUrl}/procurement`, {
    headers: headers(customerToken),
  });
  assert.equal(forbidden.status, 403);

  const procurement = await fetch(`${baseUrl}/procurement`, {
    headers: headers(adminToken),
  });
  assert.equal(procurement.status, 200);
  const procurementBody = await procurement.json();
  assert.equal(procurementBody.items.length, 1);
  assert.equal(procurementBody.items[0].recommendedPurchase, 2);
  assert.equal(procurementBody.items[0].activeEstimateQuantity, 2);

  const buyerProcurement = await fetch(`${baseUrl}/procurement`, {
    headers: headers(procurementToken),
  });
  assert.equal(buyerProcurement.status, 200);

  const buyerSchedule = await fetch(
    `${baseUrl}/calendar?from=2026-10-19T00%3A00%3A00.000Z&to=2026-10-21T00%3A00%3A00.000Z`,
    { headers: headers(procurementToken) },
  );
  assert.equal(buyerSchedule.status, 403);

  const buyerDashboard = await fetch(`${baseUrl}/dashboard`, {
    headers: headers(procurementToken),
  });
  assert.equal(buyerDashboard.status, 403);

  const dashboard = await fetch(`${baseUrl}/dashboard`, {
    headers: headers(adminToken),
  });
  assert.equal(dashboard.status, 200);
  const dashboardBody = await dashboard.json();
  assert.equal(dashboardBody.periodDays, 30);
  assert.equal(dashboardBody.activeOrders, 2);
  assert.equal(dashboardBody.averageRepairMinutes, 120);
  assert.equal(dashboardBody.collectedRub, 4500);
  assert.equal(dashboardBody.popularWorks[0].name, "Диагностика");

  const priority = await fetch(`${baseUrl}/orders/${orderId}/priority`, {
    method: "PATCH",
    headers: { ...headers(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ priority: "URGENT" }),
  });
  assert.equal(priority.status, 200);
  assert.deepEqual(updates, [{ id: orderId, data: { priority: "URGENT" } }]);

  order.status = "ASSIGNED";
  order.assignedTechnicianId = "tech-1";
  const administratorAfterAssignment = await fetch(
    `${baseUrl}/orders/${orderId}/priority`,
    {
      method: "PATCH",
      headers: {
        ...headers(adminToken),
        "content-type": "application/json",
      },
      body: JSON.stringify({ priority: "NORMAL" }),
    },
  );
  assert.equal(administratorAfterAssignment.status, 409);
  assert.equal(updates.length, 1);

  order.status = "IN_PROGRESS";
  const technicianPriority = await fetch(
    `${baseUrl}/orders/${orderId}/priority`,
    {
      method: "PATCH",
      headers: {
        ...headers(technicianToken),
        "content-type": "application/json",
      },
      body: JSON.stringify({ priority: "NORMAL" }),
    },
  );
  assert.equal(technicianPriority.status, 200);
  assert.equal(updates.length, 2);
});
