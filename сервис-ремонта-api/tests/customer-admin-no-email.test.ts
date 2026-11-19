import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { addTemporaryLoginToCustomer } from "../src/features/customers/customer-login-credentials.js";
import { createCustomerAdminRouter } from "../src/features/customers/customer.routes.js";
import type { Prisma } from "../src/generated/prisma/client.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("admin receives one-time login credentials for an email-less customer", async (t) => {
  const token = "A".repeat(48);
  const previousSecret = process.env.PASSWORD_RESET_CODE_SECRET;
  process.env.PASSWORD_RESET_CODE_SECRET =
    "test-only-credential-encryption-secret";

  const admin = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.test",
    displayName: "Admin",
    phoneNumber: null,
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  let createdUser: Record<string, unknown> | undefined;
  let storedDelivery: Record<string, unknown> | undefined;
  const user = {
    create: async ({ data }: { data: Record<string, unknown> }) => {
      createdUser = data;
      return {
        id: "22222222-2222-4222-8222-222222222222",
        email: data.email ?? null,
        displayName: data.displayName,
        phoneNumber: data.phoneNumber,
        login: data.login,
        maxUserId: null,
        active: true,
        createdAt: new Date(),
      };
    },
  };
  const transaction = {
    $queryRaw: async () => [],
    user,
    maxCredentialDelivery: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        storedDelivery = data;
        return data;
      },
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    user,
    $transaction: async <T>(operation: (tx: unknown) => Promise<T>) =>
      operation(transaction),
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCustomerAdminRouter(database as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => {
    server.close();
    if (previousSecret === undefined)
      delete process.env.PASSWORD_RESET_CODE_SECRET;
    else process.env.PASSWORD_RESET_CODE_SECRET = previousSecret;
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/admin/customers`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        displayName: "Клиент без почты",
        phoneNumber: "+7 999 555-00-01",
      }),
    },
  );

  assert.equal(response.status, 201);
  const body = await response.json();
  assert.equal(body.customer.email, null);
  assert.match(body.customer.login, /^[a-hjkmnp-z2-9]{8}$/u);
  assert.equal(typeof body.temporaryPassword, "string");
  assert.match(body.temporaryPassword, /^[A-Za-z0-9]{6}$/u);
  assert.equal("passwordHash" in body.customer, false);
  assert.equal(createdUser?.email, null);
  assert.equal(createdUser?.mustChangePassword, true);
  assert.match(String(createdUser?.passwordHash), /^scrypt\$/u);
  assert.equal(storedDelivery, undefined);
});

test("temporary customer credentials are not stored for delivery through MAX", async () => {
  const previousSecret = process.env.PASSWORD_RESET_CODE_SECRET;
  process.env.PASSWORD_RESET_CODE_SECRET =
    "test-only-credential-encryption-secret";
  const customer = {
    id: "33333333-3333-4333-8333-333333333333",
    email: null,
    login: null,
    maxUserId: "max-linked-customer",
  };
  let update: Record<string, unknown> | undefined;
  let delivery: Record<string, unknown> | undefined;
  const transaction = {
    user: {
      findUnique: async () => customer,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        update = data;
        Object.assign(customer, data);
        return customer;
      },
    },
    maxCredentialDelivery: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        delivery = data;
        return data;
      },
    },
  };

  try {
    const credentials = await addTemporaryLoginToCustomer(
      transaction as unknown as Prisma.TransactionClient,
      customer.id,
    );
    assert.ok(credentials);
    assert.match(credentials.login, /^[a-hjkmnp-z2-9]{8}$/u);
    assert.equal(credentials.maxUserId, customer.maxUserId);
    assert.equal(update?.login, credentials.login);
    assert.equal(update?.mustChangePassword, true);
    assert.match(String(update?.passwordHash), /^scrypt\$/u);
    assert.equal(delivery, undefined);
  } finally {
    if (previousSecret === undefined)
      delete process.env.PASSWORD_RESET_CODE_SECRET;
    else process.env.PASSWORD_RESET_CODE_SECRET = previousSecret;
  }
});
