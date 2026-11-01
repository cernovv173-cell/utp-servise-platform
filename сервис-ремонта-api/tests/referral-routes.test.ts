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
  const now = new Date();
  const referrer = {
    id: "22222222-2222-4222-8222-222222222222",
    role: "CUSTOMER",
    active: true,
  };
  const promoCode = {
    id: "44444444-4444-4444-8444-444444444444",
    ownerId: referrer.id,
    slot: 1,
    issuedAt: new Date(now.getTime() - 60_000),
    expiresAt: new Date(now.getTime() + 60_000),
    claimedAt: null as Date | null,
  };
  let createdUser: Record<string, unknown> | undefined;
  let recordedReferral: Record<string, unknown> | undefined;
  const transaction = {
    user: {
      findUnique: async ({
        where,
      }: {
        where: { referralCode?: string; id?: string };
      }) =>
        where.referralCode === referralCode || where.id === referrer.id
          ? referrer
          : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdUser = data;
        return { ...customer, ...data };
      },
    },
    customerReferralCode: {
      findUnique: async () => promoCode,
      updateMany: async () => {
        if (promoCode.claimedAt) return { count: 0 };
        promoCode.claimedAt = new Date();
        return { count: 1 };
      },
    },
    customerReferral: {
      findFirst: async () => null,
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
        phoneNumber: "+7 (999) 123-45-67",
        password: "ValidPassword123",
        referralCode: referralCode.toLowerCase(),
      }),
    },
  );

  assert.equal(response.status, 201);
  assert.equal(createdUser?.role, "CUSTOMER");
  assert.equal(createdUser?.referralCode, undefined);
  assert.deepEqual(recordedReferral, {
    referrerId: referrer.id,
    inviteeId: customer.id,
    promoCodeId: promoCode.id,
  });

  const repeatedResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/auth/register`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "another@example.test",
        displayName: "Ещё один клиент",
        phoneNumber: "+7 (999) 123-45-67",
        password: "ValidPassword123",
        referralCode,
      }),
    },
  );
  assert.equal(repeatedResponse.status, 400);
});

test("referral profile issues three codes and reports aggregate status", async (t) => {
  const sessionToken = "R".repeat(48);
  const authUser = { ...customer, id: "33333333-3333-4333-8333-333333333333" };
  let referralCode: string | null = null;
  const promoCodes: Array<Record<string, unknown>> = [];
  const transaction = {
    $queryRaw: async () => [],
    user: {
      findUnique: async () => ({
        id: authUser.id,
        role: "CUSTOMER",
        active: true,
        referralCode,
      }),
      update: async ({ data }: { data: { referralCode: string } }) => {
        referralCode = data.referralCode;
        return {};
      },
    },
    customerReferralCode: {
      findMany: async () => promoCodes.map((code) => ({ ...code })),
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown>>;
      }) => {
        promoCodes.push(
          ...data.map((code, index) => ({
            id: `promo-${promoCodes.length + index + 1}`,
            ...code,
          })),
        );
        return { count: data.length };
      },
    },
    customerReferral: {
      count: async ({ where }: { where: { status?: string } }) =>
        where.status === "PENDING" ? 2 : where.status === "REWARDED" ? 3 : 5,
      findFirst: async () => null,
      findMany: async () => [],
    },
  };
  const database = {
    $transaction: async (
      callback: (client: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user: authUser }
          : null,
    },
    customerReferralCode: transaction.customerReferralCode,
    customerReferral: transaction.customerReferral,
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
  assert.equal(body.codes.length, 3);
  assert.deepEqual(
    body.codes.map((code: { slot: number }) => code.slot),
    [1, 2, 3],
  );
  assert.equal(body.codeCount, 3);
  assert.equal(body.validityMonths, 6);
  assert.equal(body.rewardPoints, 250);
  assert.equal(body.totalInvites, 5);
  assert.equal(body.pendingCount, 2);
  assert.equal(body.rewardedCount, 3);
});
