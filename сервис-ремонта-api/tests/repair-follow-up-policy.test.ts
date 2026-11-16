import assert from "node:assert/strict";
import test from "node:test";

import type { PushNotification } from "../src/features/notifications/push-notifications.js";
import { getRepairFollowUpScheduledAt } from "../src/features/orders/repair-follow-up-policy.js";
import {
  repairFollowUpRetryDelayMilliseconds,
  runRepairFollowUpPushWorkerOnce,
} from "../src/features/orders/repair-follow-up-push-worker.js";
import type { DatabaseClient } from "../src/lib/database/database.js";

test("repair follow-up is scheduled exactly 48 hours after repair completion", () => {
  const completedAt = new Date("2026-11-16T12:30:00.000Z");
  assert.equal(
    getRepairFollowUpScheduledAt(completedAt).toISOString(),
    "2026-11-18T12:30:00.000Z",
  );
});

test("repair follow-up retries use bounded exponential delay", () => {
  assert.equal(repairFollowUpRetryDelayMilliseconds(1), 60_000);
  assert.equal(repairFollowUpRetryDelayMilliseconds(2), 120_000);
  assert.equal(repairFollowUpRetryDelayMilliseconds(20), 6 * 60 * 60 * 1_000);
});

test("repair follow-up worker sends the order link and records successful delivery", async () => {
  const now = new Date("2026-11-18T12:30:00.000Z");
  const claimedFollowUp = {
    id: "11111111-1111-4111-8111-111111111111",
    order_id: "22222222-2222-4222-8222-222222222222",
    customer_id: "33333333-3333-4333-8333-333333333333",
    service_number: "SRV-2026-000123",
    scheduled_at: new Date(now.getTime() - 1_000),
    attempt_count: 1,
    locked_until: new Date(now.getTime() + 90_000),
  };
  const updates: Array<{
    where: Record<string, unknown>;
    data: Record<string, unknown>;
  }> = [];
  let sentNotification: PushNotification | undefined;
  let recipientIds: readonly string[] = [];
  const transaction = {
    $queryRaw: async () => [claimedFollowUp],
  };
  const database = {
    $transaction: async <T>(
      operation: (tx: typeof transaction) => Promise<T>,
    ) => operation(transaction),
    repairOrderFollowUp: {
      updateMany: async (input: {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      }) => {
        updates.push(input);
        return { count: 1 };
      },
    },
  } as unknown as DatabaseClient;

  await runRepairFollowUpPushWorkerOnce(
    database,
    now,
    async (_database, recipients, notification) => {
      recipientIds = recipients;
      sentNotification = notification;
      return true;
    },
  );

  assert.deepEqual(recipientIds, [claimedFollowUp.customer_id]);
  assert.equal(sentNotification?.data.type, "repair_follow_up");
  assert.equal(sentNotification?.data.orderId, claimedFollowUp.order_id);
  assert.match(sentNotification?.body ?? "", /SRV-2026-000123/);
  assert.equal(
    sentNotification?.androidTag,
    `repair-follow-up-${claimedFollowUp.id}`,
  );
  assert.equal(updates.length, 1);
  assert.equal(updates[0]?.where.lockedUntil, claimedFollowUp.locked_until);
  assert.equal(updates[0]?.data.status, "SENT");
  assert.equal(updates[0]?.data.sentAt, now);
  assert.equal(updates[0]?.data.lockedUntil, null);
});
