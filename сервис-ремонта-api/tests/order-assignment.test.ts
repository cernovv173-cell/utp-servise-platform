import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("an administrator assigns during intake and may replace only a removed technician", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const technicianId = "22222222-2222-4222-8222-222222222222";
  const token = "A".repeat(48);
  const admin = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "admin@example.test",
    displayName: "Admin",
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  const technician = {
    id: technicianId,
    email: "tech@example.test",
    displayName: "New technician",
    role: "TECHNICIAN" as const,
    active: true,
    mustChangePassword: false,
  };
  const order = {
    id: orderId,
    customerId: "44444444-4444-4444-8444-444444444444",
    assignedTechnicianId: null as string | null,
    status: "REQUESTED" as
      "REQUESTED" | "ASSIGNED" | "IN_PROGRESS" | "READY_FOR_PICKUP",
  };
  const events: Array<Record<string, unknown>> = [];
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    user: {
      findUnique: async () => technician,
      findMany: async () => [],
    },
    repairOrder: {
      findUnique: async () => ({ ...order }),
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          status: string;
          assignedTechnicianId: string | null;
        };
        data: { assignedTechnicianId: string; status: string };
      }) => {
        if (
          where.id !== orderId ||
          where.status !== order.status ||
          where.assignedTechnicianId !== order.assignedTechnicianId
        )
          return { count: 0 };
        Object.assign(order, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...order }),
    },
    repairStatusEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      },
    },
    telegramNotificationDelivery: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => create,
    },
    maxNotificationDelivery: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => create,
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

  const reassign = () =>
    fetch(`http://127.0.0.1:${address.port}/api/orders/${orderId}/assign`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ technicianId }),
    });

  const assigned = await reassign();
  assert.equal(assigned.status, 200);
  assert.equal(order.assignedTechnicianId, technicianId);
  assert.equal(order.status, "ASSIGNED");
  assert.equal(events.at(-1)?.from, "REQUESTED");
  assert.equal(events.at(-1)?.to, "ASSIGNED");

  const reassigned = await reassign();
  assert.equal(reassigned.status, 409);
  assert.equal(order.assignedTechnicianId, technicianId);

  order.status = "IN_PROGRESS";
  const started = await reassign();
  assert.equal(started.status, 409);
  assert.equal(order.assignedTechnicianId, technicianId);

  order.assignedTechnicianId = null;
  const replacement = await reassign();
  assert.equal(replacement.status, 200);
  assert.equal(order.status, "IN_PROGRESS");
  assert.equal(order.assignedTechnicianId, technicianId);
  assert.equal(events.at(-1)?.from, "IN_PROGRESS");
  assert.equal(events.at(-1)?.to, "IN_PROGRESS");

  order.status = "READY_FOR_PICKUP";
  const tooLate = await reassign();
  assert.equal(tooLate.status, 409);
  assert.equal(order.assignedTechnicianId, technicianId);
});
