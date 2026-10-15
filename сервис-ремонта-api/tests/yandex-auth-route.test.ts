import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("Yandex login creates only a customer and returns an application session", async (t) => {
  const referralCode = "0123456789ABCDEF";
  const referrer = {
    id: "44444444-4444-4444-8444-444444444444",
    role: "CUSTOMER",
    active: true,
  };
  const users: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  let recordedReferral: Record<string, unknown> | undefined;
  const findUser = async ({ where }: { where: Record<string, string> }) =>
    users.find((user) =>
      Object.entries(where).every(([key, value]) => user[key] === value),
    ) ?? null;
  const transactionClient = {
    user: {
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        where.referralCode === referralCode ? referrer : findUser({ where }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const user = {
          id: "22222222-2222-4222-8222-222222222222",
          phoneNumber: null,
          avatarObjectId: null,
          active: true,
          mustChangePassword: false,
          ...data,
        };
        users.push(user);
        return user;
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
    user: { findUnique: findUser },
    $transaction: async (
      callback: (transaction: typeof transactionClient) => Promise<unknown>,
    ) => callback(transactionClient),
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        sessions.push(data);
        return data;
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createAuthRouter(database as unknown as DatabaseClient, {
      yandexClientId: "test-yandex-client-id",
      fetchYandexIdentity: async () => ({
        id: "yandex-user-100",
        email: "customer@example.test",
        displayName: "Customer",
      }),
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/auth/yandex`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: "yandex-oauth-access-token-for-test",
        portal: "CUSTOMER",
        referralCode,
      }),
    },
  );

  assert.equal(response.status, 200);
  const result = (await response.json()) as {
    accessToken: string;
    accountCreated: boolean;
    referralApplied: boolean;
    user: { role: string; email: string };
  };
  assert.equal(result.user.role, "CUSTOMER");
  assert.equal(result.user.email, "customer@example.test");
  assert.match(result.accessToken, /^[A-Za-z0-9_-]{40,}$/u);
  assert.equal(users[0]?.yandexId, "yandex-user-100");
  assert.equal(users[0]?.role, "CUSTOMER");
  assert.equal(result.accountCreated, true);
  assert.equal(result.referralApplied, true);
  assert.deepEqual(recordedReferral, {
    referrerId: referrer.id,
    inviteeId: users[0]?.id,
  });
  assert.equal(sessions.length, 1);
});

test("Yandex login requires a password before linking an existing account", async (t) => {
  const existingUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "customer@example.test",
    displayName: "Existing customer",
    phoneNumber: null,
    avatarObjectId: null,
    passwordHash: "unneeded-without-password",
    role: "CUSTOMER",
    active: true,
    mustChangePassword: false,
    yandexId: null,
  };
  const database = {
    user: {
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        "yandexId" in where ? null : existingUser,
    },
    session: {
      create: async () => assert.fail("No session should be created"),
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createAuthRouter(database as unknown as DatabaseClient, {
      yandexClientId: "test-yandex-client-id",
      fetchYandexIdentity: async () => ({
        id: "yandex-user-100",
        email: "customer@example.test",
        displayName: "Customer",
      }),
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/auth/yandex`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessToken: "yandex-oauth-access-token-for-test",
        portal: "CUSTOMER",
      }),
    },
  );

  assert.equal(response.status, 409);
  assert.equal((await response.json()).error.code, "YANDEX_PASSWORD_REQUIRED");
});
