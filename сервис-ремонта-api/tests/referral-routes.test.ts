import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import { createReferralRouter } from "../src/features/referrals/referral.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const customer = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "customer@example.test",
  displayName: "Клиент",
  phoneNumber: null,
  gender: null,
  birthDate: null,
  avatarObjectId: null,
  passwordHash: "hash",
  role: "CUSTOMER" as const,
  active: true,
  mustChangePassword: false,
  telegramChatId: null,
  maxUserId: null,
};

test("registration attaches a valid referral code and creates a customer-only link", async (t) => {
  const referralCode = "0123456789ABCDEF";
  const referrer = {
    id: "22222222-2222-4222-8222-222222222222",
    role: "CUSTOMER",
    active: true,
  };
  let createdUser: Record<string, unknown> | undefined;
  let recordedReferral: Record<string, unknown> | undefined;
  const transaction = {
    user: {
      findUnique: async ({ where }: { where: { referralCode?: string } }) =>
        where.referralCode === referralCode ? referrer : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdUser = data;
        return { ...customer, ...data };
      },
    },
    customerReferral: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedReferral = data;
        return data;
      },
    },
  };
  const database = {
    $transaction: async (
      callback: (client: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
    session: { create: async () => ({}) },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createAuthRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/auth/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "new@example.test",
        displayName: "Новый клиент",
        password: "ValidPassword123",
        referralCode: referralCode.toLowerCase(),
      }),
    },
  );

  assert.equal(response.status, 201);
  assert.equal(createdUser?.role, "CUSTOMER");
  assert.match(String(createdUser?.referralCode), /^[0-9A-F]{16}$/);
  assert.deepEqual(recordedReferral, {
    referrerId: referrer.id,
    inviteeId: customer.id,
  });
});

test("referral profile lazily creates a code and reports aggregate status", async (t) => {
  const sessionToken = "R".repeat(48);
  const authUser = { ...customer, id: "33333333-3333-4333-8333-333333333333" };
  let referralCode: string | null = null;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user: authUser }
          : null,
    },
    user: {
      findUnique: async () => ({ referralCode }),
      updateMany: async ({ data }: { data: { referralCode: string } }) => {
        referralCode ??= data.referralCode;
        return { count: 1 };
      },
    },
    customerReferral: {
      count: async ({ where }: { where: { status?: string } }) =>
        where.status === "PENDING" ? 2 : where.status === "REWARDED" ? 3 : 5,
      findMany: async () => [],
    },
  };
  const app = express();
  app.use("/api", createReferralRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/referrals/me`,
    {
      headers: { authorization: `Bearer ${sessionToken}` },
    },
  );
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.match(body.referralCode, /^[0-9A-F]{16}$/);
  assert.equal(body.totalInvites, 5);
  assert.equal(body.pendingCount, 2);
  assert.equal(body.rewardedCount, 3);
});
