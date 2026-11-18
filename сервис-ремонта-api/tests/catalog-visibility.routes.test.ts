import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCatalogRouter } from "../src/features/catalog/catalog.routes.js";
import { DEFAULT_CATALOG_VISIBILITY } from "../src/features/company/catalog-visibility-settings.js";
import { createCompanyRouter } from "../src/features/company/company.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("catalog visibility is public to read and administrator-only to update", async (t) => {
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

  const initial = await fetch(`${endpoint}/company/catalog-visibility`);
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  assert.deepEqual(await initial.json(), DEFAULT_CATALOG_VISIBILITY);

  const settings = { servicesVisible: false, productsVisible: false };
  const forbidden = await fetch(
    `${endpoint}/admin/company/catalog-visibility`,
    {
      method: "PUT",
      headers: {
        authorization: `Bearer ${customerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(settings),
    },
  );
  assert.equal(forbidden.status, 403);

  const saved = await fetch(`${endpoint}/admin/company/catalog-visibility`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(settings),
  });
  assert.equal(saved.status, 200);
  assert.deepEqual(await saved.json(), settings);

  const invalid = await fetch(`${endpoint}/admin/company/catalog-visibility`, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ ...settings, sparePartsVisible: false }),
  });
  assert.equal(invalid.status, 400);
});

test("public service prices are withheld when services are hidden", async (t) => {
  let serviceCatalogReads = 0;
  const databaseClient = {
    appSetting: {
      findUnique: async () => ({
        value: { servicesVisible: false, productsVisible: true },
      }),
    },
    repairCatalogItem: {
      findMany: async () => {
        serviceCatalogReads += 1;
        return [{ id: "service-1", name: "Диагностика", unitPriceRub: 1000 }];
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCatalogRouter(databaseClient as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/public/service-prices`,
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { prices: [] });
  assert.equal(serviceCatalogReads, 0);
});
