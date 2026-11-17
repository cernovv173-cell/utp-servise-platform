import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { DEFAULT_CLOSURE_ANNOUNCEMENT } from "../src/features/company/closure-announcement-settings.js";
import { createCompanyRouter } from "../src/features/company/company.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("closure announcement settings are public to read and administrator-only to update", async (t) => {
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

  const initial = await fetch(`${endpoint}/company/closure-announcement`);
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  assert.deepEqual(await initial.json(), DEFAULT_CLOSURE_ANNOUNCEMENT);

  const forbidden = await fetch(
    `${endpoint}/admin/company/closure-announcement`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${customerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ ...DEFAULT_CLOSURE_ANNOUNCEMENT, enabled: false }),
    },
  );
  assert.equal(forbidden.status, 403);

  const savedSettings = {
    ...DEFAULT_CLOSURE_ANNOUNCEMENT,
    enabled: false,
    title: "ПЕРЕРЫВ В РАБОТЕ",
    endDate: "2027-01-12",
    reopenTime: "09:15",
    phoneNumber: "+79990000000",
  };
  const saved = await fetch(`${endpoint}/admin/company/closure-announcement`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(savedSettings),
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), savedSettings);
  assert.deepEqual(
    await (await fetch(`${endpoint}/company/closure-announcement`)).json(),
    savedSettings,
  );
});

test("closure announcement rejects impossible and reversed dates", async (t) => {
  const adminToken = "A".repeat(48);
  const databaseClient = {
    appSetting: {
      findUnique: async () => null,
      upsert: async () => null,
    },
    session: {
      findUnique: async () => ({
        expiresAt: new Date(Date.now() + 60_000),
        user: {
          id: "admin",
          role: "ADMIN",
          active: true,
          terminatedAt: null,
          mustChangePassword: false,
        },
      }),
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

  for (const dates of [
    { startDate: "2027-02-30", endDate: "2027-03-01" },
    { startDate: "2027-03-02", endDate: "2027-03-01" },
  ]) {
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/admin/company/closure-announcement`,
      {
        method: "PUT",
        headers: {
          authorization: `Bearer ${adminToken}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ ...DEFAULT_CLOSURE_ANNOUNCEMENT, ...dates }),
      },
    );
    assert.equal(response.status, 400);
  }
});
