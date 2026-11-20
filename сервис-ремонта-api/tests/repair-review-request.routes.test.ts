import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import type { PushNotification } from "../src/features/notifications/push-notifications.js";
import { createRepairReviewRequestRouter } from "../src/features/orders/repair-review-request.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("assigned technicians can request one review after a completed repair", async (t) => {
  const ids = {
    technician: "11111111-1111-4111-8111-111111111111",
    otherTechnician: "22222222-2222-4222-8222-222222222222",
    customer: "33333333-3333-4333-8333-333333333333",
    completedOrder: "44444444-4444-4444-8444-444444444444",
    retryOrder: "55555555-5555-4555-8555-555555555555",
    incompleteOrder: "66666666-6666-4666-8666-666666666666",
    reviewedOrder: "77777777-7777-4777-8777-777777777777",
    otherTechnicianOrder: "88888888-8888-4888-8888-888888888888",
  };
  const tokens = {
    technician: "T".repeat(48),
    otherTechnician: "O".repeat(48),
  };
  const users = [
    {
      id: ids.technician,
      displayName: "Мастер",
      email: "tech@example.test",
      login: null,
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.technician,
    },
    {
      id: ids.otherTechnician,
      displayName: "Другой мастер",
      email: "other-tech@example.test",
      login: null,
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.otherTechnician,
    },
  ];
  const sessions = users.map((user) => ({
    ...user,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const order = (
    id: string,
    status: string,
    assignedTechnicianId: string,
    review: { id: string } | null = null,
  ) => ({
    id,
    serviceNumber: `SRV-${id.slice(0, 8)}`,
    customerId: ids.customer,
    assignedTechnicianId,
    status,
    reviewRequestedAt: null as Date | null,
    reviewRequestedById: null as string | null,
    review,
  });
  const orders = new Map([
    [
      ids.completedOrder,
      order(ids.completedOrder, "COMPLETED", ids.technician),
    ],
    [ids.retryOrder, order(ids.retryOrder, "COMPLETED", ids.technician)],
    [
      ids.incompleteOrder,
      order(ids.incompleteOrder, "IN_PROGRESS", ids.technician),
    ],
    [
      ids.reviewedOrder,
      order(ids.reviewedOrder, "COMPLETED", ids.technician, {
        id: "review-id",
      }),
    ],
    [
      ids.otherTechnicianOrder,
      order(ids.otherTechnicianOrder, "COMPLETED", ids.otherTechnician),
    ],
  ]);
  let failNotification = false;
  const sentNotifications: Array<{
    recipientIds: readonly string[];
    notification: PushNotification;
  }> = [];

  let client: Record<string, unknown>;
  client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (item) => hashSessionToken(item.token) === where.tokenHash,
        );
        if (!session) return null;
        const { token: _token, ...user } = session;
        return { expiresAt: session.expiresAt, user };
      },
    },
    repairOrder: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        orders.get(where.id) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          status: string;
          assignedTechnicianId: string;
          reviewRequestedAt: null;
        };
        data: { reviewRequestedAt: Date; reviewRequestedById: string };
      }) => {
        const current = orders.get(where.id);
        if (
          !current ||
          current.status !== where.status ||
          current.assignedTechnicianId !== where.assignedTechnicianId ||
          current.reviewRequestedAt !== null
        ) {
          return { count: 0 };
        }
        Object.assign(current, data);
        return { count: 1 };
      },
    },
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) =>
      operation(client),
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createRepairReviewRequestRouter(
      client as unknown as DatabaseClient,
      async (_database, recipientIds, notification) => {
        sentNotifications.push({ recipientIds, notification });
        return !failNotification;
      },
    ),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders`;
  const requestReview = (orderId: string, token = tokens.technician) =>
    fetch(`${endpoint}/${orderId}/review-request`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });

  const response = await requestReview(ids.completedOrder);
  assert.equal(response.status, 200);
  const result = (await response.json()) as {
    reviewRequestedAt: string;
    alreadyRequested: boolean;
    notificationSent: boolean | null;
  };
  assert.ok(result.reviewRequestedAt);
  assert.equal(result.alreadyRequested, false);
  assert.equal(result.notificationSent, true);
  assert.equal(
    orders.get(ids.completedOrder)?.reviewRequestedById,
    ids.technician,
  );
  assert.deepEqual(sentNotifications[0]?.recipientIds, [ids.customer]);
  assert.equal(
    sentNotifications[0]?.notification.data.type,
    "repair_review_request",
  );
  assert.equal(
    sentNotifications[0]?.notification.data.orderId,
    ids.completedOrder,
  );

  const repeatedResponse = await requestReview(ids.completedOrder);
  assert.equal(repeatedResponse.status, 200);
  assert.equal(
    ((await repeatedResponse.json()) as { alreadyRequested: boolean })
      .alreadyRequested,
    true,
  );
  assert.equal(sentNotifications.length, 1);

  failNotification = true;
  const failedPushResponse = await requestReview(ids.retryOrder);
  assert.equal(failedPushResponse.status, 200);
  assert.equal(
    ((await failedPushResponse.json()) as { notificationSent: boolean })
      .notificationSent,
    false,
  );
  assert.ok(orders.get(ids.retryOrder)?.reviewRequestedAt);

  assert.equal((await requestReview(ids.incompleteOrder)).status, 409);
  assert.equal((await requestReview(ids.reviewedOrder)).status, 409);
  assert.equal((await requestReview(ids.otherTechnicianOrder)).status, 404);
  assert.equal(
    (await requestReview(ids.completedOrder, tokens.otherTechnician)).status,
    404,
  );
});
