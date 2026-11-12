import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("deadline changes are recorded and unchanged deadlines do not notify again", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const customerId = "22222222-2222-4222-8222-222222222222";
  const adminId = "33333333-3333-4333-8333-333333333333";
  const token = "A".repeat(48);
  const admin = {
    id: adminId,
    email: "admin@example.test",
    displayName: "Администратор",
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  const order = {
    id: orderId,
    customerId,
    assignedTechnicianId: null,
    expectedCompletionAt: null as Date | null,
  };
  const deadlineChanges: Array<Record<string, unknown>> = [];
  let notificationAttempts = 0;
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    user: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.isAdminAssistant !== true) notificationAttempts += 1;
        return [];
      },
    },
    repairOrder: {
      findUnique: async () => ({ ...order }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; expectedCompletionAt: Date | null };
        data: { expectedCompletionAt: Date | null };
      }) => {
        if (
          where.id !== orderId ||
          where.expectedCompletionAt?.getTime() !==
            order.expectedCompletionAt?.getTime()
        ) {
          return { count: 0 };
        }
        order.expectedCompletionAt = data.expectedCompletionAt;
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        ...order,
        deadlineChanges: [...deadlineChanges].reverse(),
      }),
    },
    repairOrderDeadlineChange: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const entry = {
          id: `change-${deadlineChanges.length + 1}`,
          createdAt: new Date(),
          ...data,
          actor: { id: adminId, displayName: admin.displayName },
        };
        deadlineChanges.push(entry);
        return entry;
      },
    },
    pushDeviceToken: { findMany: async () => [] },
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

  const updateDeadline = (expectedCompletionAt: string | null, note?: string) =>
    fetch(
      `http://127.0.0.1:${address.port}/api/orders/${orderId}/expected-completion`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expectedCompletionAt, note }),
      },
    );

  const firstDate = "2026-11-12T12:00:00.000Z";
  const firstUpdate = await updateDeadline(firstDate, "Ждём поставку детали");
  assert.equal(firstUpdate.status, 200);
  assert.equal(deadlineChanges.length, 1);
  assert.equal(deadlineChanges[0]?.previousExpectedAt, null);
  assert.equal(deadlineChanges[0]?.note, "Ждём поставку детали");
  assert.equal(notificationAttempts, 1);

  const unchanged = await updateDeadline(firstDate, "Повтор запроса");
  assert.equal(unchanged.status, 200);
  assert.equal(deadlineChanges.length, 1);
  assert.equal(notificationAttempts, 1);

  const nextDate = "2026-11-14T12:00:00.000Z";
  const moved = await updateDeadline(nextDate, "Поставка задержалась");
  assert.equal(moved.status, 200);
  assert.equal(deadlineChanges.length, 2);
  assert.equal(
    (deadlineChanges[1]?.previousExpectedAt as Date).toISOString(),
    firstDate,
  );
  assert.equal(notificationAttempts, 2);

  const cleared = await updateDeadline(null, "Срок уточним после диагностики");
  assert.equal(cleared.status, 200);
  assert.equal(deadlineChanges.length, 3);
  assert.equal(deadlineChanges[2]?.expectedCompletionAt, null);
  assert.equal(notificationAttempts, 3);
});
