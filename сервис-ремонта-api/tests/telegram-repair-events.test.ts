import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("assigned technicians can record diagnosis once and queue one customer notification", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const customerId = "22222222-2222-4222-8222-222222222222";
  const technicianId = "33333333-3333-4333-8333-333333333333";
  const token = "T".repeat(48);
  const otherToken = "O".repeat(48);
  const technician = {
    id: technicianId,
    email: "technician@example.test",
    displayName: "Назначенный мастер",
    phoneNumber: null,
    avatarObjectId: null,
    role: "TECHNICIAN" as const,
    active: true,
    mustChangePassword: false,
    telegramChatId: null,
  };
  const otherTechnician = {
    ...technician,
    id: "44444444-4444-4444-8444-444444444444",
    email: "other@example.test",
  };
  const users = [
    { ...technician, token },
    { ...otherTechnician, token: otherToken },
  ];
  const order = {
    id: orderId,
    customerId,
    assignedTechnicianId: technicianId as string | null,
    status: "ASSIGNED" as "ASSIGNED" | "IN_PROGRESS",
    diagnosisCompletedAt: null as Date | null,
  };
  const events: Array<Record<string, unknown>> = [];
  const deliveries: Array<Record<string, unknown>> = [];
  const maxDeliveries: Array<Record<string, unknown>> = [];
  const transaction = {
    $queryRaw: async () => [],
    repairOrder: {
      findUnique: async () => ({ ...order }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; diagnosisCompletedAt: null; status: string };
        data: { diagnosisCompletedAt: Date };
      }) => {
        if (
          where.id !== order.id ||
          where.diagnosisCompletedAt !== null ||
          where.status !== order.status ||
          order.diagnosisCompletedAt !== null
        ) {
          return { count: 0 };
        }
        Object.assign(order, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        ...order,
        customer: { id: customerId, displayName: "Клиент" },
        assignedTechnician: {
          id: technicianId,
          displayName: technician.displayName,
        },
        statusEvents: [],
        items: [],
        photos: [],
        intake: null,
        warranty: null,
      }),
    },
    repairStatusEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        events.push(data);
        return data;
      },
    },
    telegramNotificationDelivery: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        deliveries.push(create);
        return create;
      },
    },
    maxNotificationDelivery: {
      upsert: async ({ create }: { create: Record<string, unknown> }) => {
        maxDeliveries.push(create);
        return create;
      },
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (candidate) => hashSessionToken(candidate.token) === where.tokenHash,
        );
        if (!user) return null;
        const { token: _token, ...sessionUser } = user;
        return { expiresAt: new Date(Date.now() + 60_000), user: sessionUser };
      },
    },
    $transaction: async <T>(
      operation: (value: typeof transaction) => Promise<T>,
    ) => operation(transaction),
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
  const endpoint = `http://127.0.0.1:${address.port}/api/orders/${orderId}/diagnosis-completed`;

  const completeDiagnosis = (sessionToken: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: { authorization: `Bearer ${sessionToken}` },
    });

  const completed = await completeDiagnosis(token);
  assert.equal(completed.status, 200);
  assert.ok(order.diagnosisCompletedAt instanceof Date);
  assert.equal(events.length, 1);
  assert.equal(events[0]?.note, "Диагностика завершена");
  assert.equal(deliveries.length, 1);
  assert.equal(deliveries[0]?.orderId, orderId);
  assert.equal(deliveries[0]?.userId, customerId);
  assert.equal(deliveries[0]?.type, "DIAGNOSIS_COMPLETED");
  assert.equal(maxDeliveries.length, 1);
  assert.equal(maxDeliveries[0]?.orderId, orderId);
  assert.equal(maxDeliveries[0]?.userId, customerId);
  assert.equal(maxDeliveries[0]?.type, "DIAGNOSIS_COMPLETED");

  const repeated = await completeDiagnosis(token);
  assert.equal(repeated.status, 200);
  assert.equal(events.length, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(maxDeliveries.length, 1);

  const unauthorized = await completeDiagnosis(otherToken);
  assert.equal(unauthorized.status, 404);
  assert.equal(events.length, 1);
  assert.equal(deliveries.length, 1);
  assert.equal(maxDeliveries.length, 1);
});
