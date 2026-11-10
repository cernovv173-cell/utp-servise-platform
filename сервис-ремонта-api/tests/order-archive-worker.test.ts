import assert from "node:assert/strict";
import test from "node:test";

import { archivePreviousDayClosedOrders } from "../src/features/orders/order-archive-worker.js";
import type { DatabaseClient } from "../src/lib/database/database.js";

test("only completed or cancelled orders are archived after the Moscow day they were closed", async () => {
  let query: Record<string, unknown> | undefined;
  const database = {
    repairOrder: {
      updateMany: async (input: Record<string, unknown>) => {
        query = input;
        return { count: 3 };
      },
    },
  };
  const now = new Date("2026-10-03T21:00:30.000Z");

  const archivedCount = await archivePreviousDayClosedOrders(
    database as unknown as DatabaseClient,
    now,
  );

  assert.equal(archivedCount, 3);
  assert.deepEqual(query, {
    where: {
      archivedAt: null,
      status: { in: ["COMPLETED", "CANCELLED"] },
      updatedAt: { lt: new Date("2026-10-03T21:00:00.000Z") },
    },
    data: { archivedAt: now },
  });
});
