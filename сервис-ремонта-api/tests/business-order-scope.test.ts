import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("customer order scopes filter by the signed-in owner's business profile", async (t) => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const technicianId = "33333333-3333-4333-8333-333333333333";
  const profileId = "44444444-4444-4444-8444-444444444444";
  const users = [
    { id: ownerId, role: "CUSTOMER" as const, token: "O".repeat(48) },
    { id: otherId, role: "CUSTOMER" as const, token: "C".repeat(48) },
    { id: technicianId, role: "TECHNICIAN" as const, token: "T".repeat(48) },
  ];
  const calls: Record<string, any>[] = [];
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        if (!user) return null;
        return {
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            email: null,
            login: null,
            displayName: user.role,
            phoneNumber: null,
            gender: null,
            birthDate: null,
            telegramChatId: null,
            maxUserId: null,
            avatarObjectId: null,
            active: true,
            mustChangePassword: false,
            ...user,
          },
        };
      },
    },
    customerBusinessProfile: {
      findUnique: async ({ where }: { where: { ownerUserId: string } }) =>
        where.ownerUserId === ownerId ? { id: profileId } : null,
    },
    repairOrder: {
      findMany: async (input: Record<string, any>) => {
        calls.push(input);
        return [];
      },
    },
  };
  const app = express();
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders`;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  const businessList = await fetch(`${endpoint}?scope=business`, {
    headers: auth(users[0]!.token),
  });
  assert.equal(businessList.status, 200);
  assert.deepEqual((await businessList.json()).orders, []);
  assert.deepEqual(calls[0]?.where, {
    customerId: ownerId,
    businessProfileId: profileId,
  });

  const personalList = await fetch(`${endpoint}?scope=personal`, {
    headers: auth(users[0]!.token),
  });
  assert.equal(personalList.status, 200);
  assert.deepEqual(calls[1]?.where, {
    customerId: ownerId,
    businessProfileId: null,
  });

  const businessSearch = await fetch(
    `${endpoint}/search?serviceNumber=SRV-2026&scope=business`,
    { headers: auth(users[0]!.token) },
  );
  assert.equal(businessSearch.status, 200);
  assert.deepEqual(calls[2]?.where, {
    customerId: ownerId,
    businessProfileId: profileId,
    serviceNumber: { contains: "SRV-2026", mode: "insensitive" },
  });

  const noProfile = await fetch(`${endpoint}?scope=business`, {
    headers: auth(users[1]!.token),
  });
  assert.equal(noProfile.status, 200);
  assert.deepEqual(await noProfile.json(), { orders: [] });
  assert.equal(calls.length, 3);

  const staffScope = await fetch(`${endpoint}?scope=business`, {
    headers: auth(users[2]!.token),
  });
  assert.equal(staffScope.status, 400);
  assert.equal(calls.length, 3);
});
