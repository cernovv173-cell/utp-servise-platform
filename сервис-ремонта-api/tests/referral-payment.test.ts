import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("a referral is paid with the first repair receipt, not repeated confirmations", async (t) => {
  const sessionToken = "A".repeat(48);
  const customerId = "11111111-1111-4111-8111-111111111111";
  const orderId = "22222222-2222-4222-8222-222222222222";
  const receiptId = "33333333-3333-4333-8333-333333333333";
  const admin = {
    id: "44444444-4444-4444-8444-444444444444",
    email: "admin@example.test",
    displayName: "Администратор",
    phoneNumber: null,
    avatarObjectId: null,
    role: "ADMIN" as const,
    salaryRatePercent: 75,
    active: true,
    mustChangePassword: false,
  };
  const receipt = {
    id: receiptId,
    receiptNumber: "DOC-2026-000001",
    paymentStatus: "PENDING" as "PENDING" | "PAID",
    totalRub: 1_000,
    itemsSnapshot: [],
  };
  const order = {
    id: orderId,
    customerId,
    serviceNumber: "SRV-2026-000001",
    status: "COMPLETED",
    redeemBonuses: false,
    receipt: { id: receiptId },
    items: [{ type: "SERVICE", quantity: 1, unitPriceRub: 1_000 }],
  };
  const referral = {
    id: "55555555-5555-4555-8555-555555555555",
    referrerId: "66666666-6666-4666-8666-666666666666",
    status: "PENDING" as "PENDING" | "REWARDED",
  };
  const loyaltyEntries: Array<Record<string, unknown>> = [];
  const transaction = {
    $queryRaw: async () => [],
    repairOrder: {
      findUnique: async () => order,
      update: async () => order,
    },
    repairReceipt: {
      findUniqueOrThrow: async () => receipt,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(receipt, data);
        return { count: 1 };
      },
    },
    loyaltyTransaction: {
      aggregate: async () => ({ _sum: { points: 0 } }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        loyaltyEntries.push(data);
        return data;
      },
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown>>;
      }) => {
        loyaltyEntries.push(...data);
        return { count: data.length };
      },
    },
    customerReferral: {
      findUnique: async () => referral,
      updateMany: async ({ data }: { data: { status: "REWARDED" } }) => {
        if (referral.status !== "PENDING") return { count: 0 };
        referral.status = data.status;
        return { count: 1 };
      },
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    repairOrder: { findUnique: async () => null },
    $transaction: async (
      callback: (client: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
  };
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    Object.assign(request, {
      log: { error: console.error },
      id: "referral-payment-test",
    });
    next();
  });
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders/${orderId}/receipt/payment`;
  const request = () =>
    fetch(endpoint, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ paymentMethod: "CASH" }),
    });

  assert.equal((await request()).status, 200);
  assert.equal((await request()).status, 200);
  const referralAwards = loyaltyEntries.filter(
    (entry) => entry.referralId === referral.id,
  );
  assert.equal(receipt.paymentStatus, "PAID");
  assert.equal(referral.status, "REWARDED");
  assert.equal(referralAwards.length, 2);
  assert.deepEqual(
    referralAwards.map((entry) => entry.points),
    [250, 250],
  );
  assert.deepEqual(
    referralAwards.map((entry) => entry.customerId),
    [referral.referrerId, customerId],
  );
  assert.deepEqual(
    referralAwards.map((entry) => entry.type),
    ["REFERRAL_REWARD", "REFERRAL_REWARD"],
  );
});
