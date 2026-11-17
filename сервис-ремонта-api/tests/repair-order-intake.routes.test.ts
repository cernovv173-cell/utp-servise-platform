import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCompanyRouter } from "../src/features/company/company.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("repair order intake is public to read and restricted to administrators to update", async (t) => {
  const adminToken = "A".repeat(48);
  const customerToken = "C".repeat(48);
  let storedValue: unknown = null;
  const users = new Map([
    [adminToken, { id: "admin", role: "ADMIN" as const }],
    [customerToken, { id: "customer", role: "CUSTOMER" as const }],
  ]);
  const databaseClient = {
    appSetting: {
      findUnique: async () =>
        storedValue === null ? null : { value: storedValue },
      upsert: async ({
        create,
        update,
      }: {
        create: { value: unknown };
        update: { value: unknown };
      }) => {
        storedValue = update.value ?? create.value;
        return { value: storedValue };
      },
    },
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const entry = [...users.entries()].find(
          ([token]) => hashSessionToken(token) === where.tokenHash,
        )?.[1];
        if (!entry) return null;
        return {
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            email: null,
            login: null,
            displayName: entry.role,
            phoneNumber: null,
            gender: null,
            birthDate: null,
            telegramChatId: null,
            maxUserId: null,
            avatarObjectId: null,
            active: true,
            terminatedAt: null,
            mustChangePassword: false,
            ...entry,
          },
        };
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCompanyRouter(databaseClient as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api`;

  const initial = await fetch(`${endpoint}/company/order-intake`);
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  assert.deepEqual(await initial.json(), { acceptingNewOrders: true });

  const forbidden = await fetch(`${endpoint}/admin/company/order-intake`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${customerToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ acceptingNewOrders: false }),
  });
  assert.equal(forbidden.status, 403);

  const paused = await fetch(`${endpoint}/admin/company/order-intake`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ acceptingNewOrders: false }),
  });
  assert.equal(paused.status, 200);
  assert.deepEqual(await paused.json(), { acceptingNewOrders: false });
  assert.deepEqual(
    await (await fetch(`${endpoint}/company/order-intake`)).json(),
    {
      acceptingNewOrders: false,
    },
  );
});
