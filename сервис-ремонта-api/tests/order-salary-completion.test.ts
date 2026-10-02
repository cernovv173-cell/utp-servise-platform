import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("completing a repair records 75 percent of service lines at the completion time", async (t) => {
  const token = "T".repeat(48);
  const technician = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "technician@example.test",
    displayName: "Мастер",
    phoneNumber: null,
    avatarObjectId: null,
    role: "TECHNICIAN" as const,
    active: true,
    mustChangePassword: false,
  };
  const completedAt = new Date("2026-10-02T12:00:00.000Z");
  let currentOrder = {
    id: "22222222-2222-4222-8222-222222222222",
    customerId: "33333333-3333-4333-8333-333333333333",
    assignedTechnicianId: technician.id,
    status: "IN_PROGRESS" as const,
  };
  let recordedSalary: Record<string, unknown> | undefined;
  let itemQuery: Record<string, unknown> | undefined;
  const transaction = {
    repairOrder: {
      findUnique: async () => currentOrder,
      updateMany: async ({
        data,
      }: {
        data: { status: "COMPLETED" | "CANCELLED" };
      }) => {
        currentOrder = { ...currentOrder, status: data.status };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => currentOrder,
    },
    repairStatusEvent: {
      create: async () => ({ createdAt: completedAt }),
    },
    repairOrderItem: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        itemQuery = where;
        return [
          { quantity: 2, unitPriceRub: 500 },
          { quantity: 1, unitPriceRub: 200 },
        ];
      },
    },
    technicianSalaryEntry: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedSalary = data;
        return data;
      },
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: technician }
          : null,
    },
    $transaction: async (
      callback: (client: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
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

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/${currentOrder.id}/status`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "COMPLETED" }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(itemQuery, { orderId: currentOrder.id, type: "SERVICE" });
  assert.equal(recordedSalary?.technicianId, technician.id);
  assert.equal(recordedSalary?.serviceTotalRub, 1_200);
  assert.equal(recordedSalary?.salaryRub, 900);
  assert.equal(recordedSalary?.ratePercent, 75);
  assert.equal(
    (recordedSalary?.earnedAt as Date).toISOString(),
    completedAt.toISOString(),
  );
});
