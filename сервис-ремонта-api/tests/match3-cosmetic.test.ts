import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createMatch3CosmeticRouter } from "../src/features/game/match3/match3-cosmetic.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const customerToken = "C".repeat(48);
const secondDeviceToken = "D".repeat(48);
const otherCustomerToken = "O".repeat(48);
const adminToken = "A".repeat(48);

test("raccoon visor preference syncs per customer without changing campaign records", async (t) => {
  const customer = {
    id: "customer-1",
    email: "customer@test.invalid",
    displayName: "Customer",
    phoneNumber: null,
    gender: null,
    birthDate: null,
    telegramChatId: null,
    maxUserId: null,
    avatarObjectId: null,
    role: "CUSTOMER" as const,
    salaryRatePercent: 75,
    active: true,
    mustChangePassword: false,
    match3CosmeticId: null as string | null,
  };
  const otherCustomer = {
    ...customer,
    id: "customer-2",
    match3CosmeticId: null,
  };
  const admin = {
    ...customer,
    id: "admin-1",
    email: "admin@test.invalid",
    role: "ADMIN" as const,
    match3CosmeticId: null,
  };
  const users = [customer, otherCustomer, admin];
  const sessions = new Map([
    [hashSessionToken(customerToken), customer],
    [hashSessionToken(secondDeviceToken), customer],
    [hashSessionToken(otherCustomerToken), otherCustomer],
    [hashSessionToken(adminToken), admin],
  ]);
  const completedLevels = new Map([
    [customer.id, 20],
    [otherCustomer.id, 0],
  ]);
  const campaignPoints = new Map([[customer.id, 125]]);
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = sessions.get(where.tokenHash);
        return user ? { user, expiresAt: new Date(Date.now() + 60_000) } : null;
      },
    },
    user: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        const user = users.find((entry) => entry.id === where.id);
        return user ? { match3CosmeticId: user.match3CosmeticId } : null;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; match3CosmeticId: null };
        data: { match3CosmeticId: string };
      }) => {
        const user = users.find((entry) => entry.id === where.id);
        if (!user || user.match3CosmeticId !== where.match3CosmeticId) {
          return { count: 0 };
        }
        user.match3CosmeticId = data.match3CosmeticId;
        return { count: 1 };
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: { match3CosmeticId: string };
      }) => {
        const user = users.find((entry) => entry.id === where.id);
        assert.ok(user);
        user.match3CosmeticId = data.match3CosmeticId;
        return { id: user.id };
      },
    },
    match3LevelCompletion: {
      count: async ({ where }: { where: { customerId: string } }) =>
        completedLevels.get(where.customerId) ?? 0,
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createMatch3CosmeticRouter(client as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/game/match3/cosmetic`;
  const request = (
    path: string,
    token: string,
    method = "GET",
    body?: unknown,
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

  const unauthenticated = await fetch(baseUrl);
  assert.equal(unauthenticated.status, 401);
  const forbidden = await request("", adminToken);
  assert.equal(forbidden.status, 403);

  const initialize = await request("/initialize", customerToken, "POST", {
    cosmeticId: "forest",
  });
  assert.equal(initialize.status, 200);
  assert.deepEqual(await initialize.json(), { selectedCosmeticId: "forest" });

  const secondDevice = await request("/initialize", secondDeviceToken, "POST", {
    cosmeticId: "default",
  });
  assert.deepEqual(await secondDevice.json(), { selectedCosmeticId: "forest" });

  const locked = await request("", customerToken, "PUT", {
    cosmeticId: "crystal",
  });
  assert.equal(locked.status, 409);
  assert.equal(customer.match3CosmeticId, "forest");

  const changed = await request("", customerToken, "PUT", {
    cosmeticId: "default",
  });
  assert.equal(changed.status, 200);
  assert.deepEqual(await changed.json(), { selectedCosmeticId: "default" });
  const selectedAgain = await request("", customerToken, "PUT", {
    cosmeticId: "forest",
  });
  assert.equal(selectedAgain.status, 200);
  assert.equal(customer.match3CosmeticId, "forest");

  const invalid = await request("", customerToken, "PUT", {
    cosmeticId: "unknown",
  });
  assert.equal(invalid.status, 400);
  const secondDeviceRead = await request("", secondDeviceToken);
  assert.deepEqual(await secondDeviceRead.json(), {
    selectedCosmeticId: "forest",
  });

  const otherAccountBeforeInitialization = await request(
    "",
    otherCustomerToken,
  );
  assert.deepEqual(await otherAccountBeforeInitialization.json(), {
    selectedCosmeticId: null,
  });
  const otherDeviceLocked = await request(
    "/initialize",
    otherCustomerToken,
    "POST",
    { cosmeticId: "first-boot" },
  );
  assert.deepEqual(await otherDeviceLocked.json(), {
    selectedCosmeticId: "default",
  });
  const otherAccount = await request("", otherCustomerToken);
  assert.deepEqual(await otherAccount.json(), {
    selectedCosmeticId: "default",
  });

  assert.equal(completedLevels.get(customer.id), 20);
  assert.equal(campaignPoints.get(customer.id), 125);
});
