import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerBusinessProfileRouter } from "../src/features/business/business-profile.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("business profile is created and read only for its signed-in customer", async (t) => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const technicianId = "33333333-3333-4333-8333-333333333333";
  const tokens = new Map([
    ["O".repeat(48), { id: ownerId, role: "CUSTOMER" as const }],
    ["C".repeat(48), { id: otherId, role: "CUSTOMER" as const }],
    ["T".repeat(48), { id: technicianId, role: "TECHNICIAN" as const }],
  ]);
  type ProfileRecord = {
    id: string;
    ownerUserId: string;
    companyName: string;
    createdAt: Date;
    updatedAt: Date;
  };
  const profiles = new Map<string, ProfileRecord>();
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = [...tokens.entries()].find(
          ([token]) => hashSessionToken(token) === where.tokenHash,
        )?.[1];
        return user
          ? {
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
            }
          : null;
      },
    },
    customerBusinessProfile: {
      findUnique: async ({ where }: { where: { ownerUserId: string } }) =>
        profiles.get(where.ownerUserId) ?? null,
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { ownerUserId: string };
        create: { ownerUserId: string; companyName: string };
        update: { companyName: string };
      }) => {
        const existing = profiles.get(where.ownerUserId);
        const profile: ProfileRecord = {
          id:
            existing?.id ??
            `${where.ownerUserId.slice(0, 8)}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`,
          ownerUserId: where.ownerUserId,
          companyName: existing ? update.companyName : create.companyName,
          createdAt: existing?.createdAt ?? new Date(),
          updatedAt: new Date(),
        };
        profiles.set(where.ownerUserId, profile);
        return profile;
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCustomerBusinessProfileRouter(database as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/customer/business-profile`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });

  const initial = await fetch(endpoint, { headers: headers("O".repeat(48)) });
  assert.equal(initial.status, 200);
  assert.equal(initial.headers.get("cache-control"), "no-store");
  assert.deepEqual(await initial.json(), { profile: null });

  const saved = await fetch(endpoint, {
    method: "PUT",
    headers: {
      ...headers("O".repeat(48)),
      "content-type": "application/json",
    },
    body: JSON.stringify({ companyName: "  ООО Альфа  " }),
  });
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).profile.companyName, "ООО Альфа");
  assert.equal(profiles.get(ownerId)?.ownerUserId, ownerId);
  assert.equal(profiles.get(ownerId)?.companyName, "ООО Альфа");

  const otherCustomer = await fetch(endpoint, {
    headers: headers("C".repeat(48)),
  });
  assert.equal(otherCustomer.status, 200);
  assert.deepEqual(await otherCustomer.json(), { profile: null });

  const spoofedOwner = await fetch(endpoint, {
    method: "PUT",
    headers: {
      ...headers("C".repeat(48)),
      "content-type": "application/json",
    },
    body: JSON.stringify({ companyName: "ООО Чужое", ownerUserId: ownerId }),
  });
  assert.equal(spoofedOwner.status, 400);

  const forbiddenRole = await fetch(endpoint, {
    headers: headers("T".repeat(48)),
  });
  assert.equal(forbiddenRole.status, 403);
});
