import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerAdminRouter } from "../src/features/customers/customer.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const customerId = "22222222-2222-4222-8222-222222222222";
const adminId = "11111111-1111-4111-8111-111111111111";
const repairOrderId = "33333333-3333-4333-8333-333333333333";
const craftOrderId = "44444444-4444-4444-8444-444444444444";

const createHarness = (failOnceFor?: string) => {
  const tokens = { admin: "A".repeat(48), customer: "C".repeat(48) };
  const users = [
    {
      id: adminId,
      email: "admin@example.test",
      displayName: "Администратор",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN",
      active: true,
      mustChangePassword: false,
      token: tokens.admin,
    },
    {
      id: customerId,
      email: "client@example.test",
      displayName: "Клиент",
      phoneNumber: null,
      avatarObjectId: "avatar-photo",
      role: "CUSTOMER",
      active: true,
      mustChangePassword: false,
      token: tokens.customer,
    },
  ];
  const sessions = users.map((user) => ({
    userId: user.id,
    token: user.token,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const calls: Array<{ model: string; method: string; args?: unknown }> = [];
  const storageDeleted = new Set<string>();
  let failedOnce = false;

  const record = (model: string, method: string, args?: unknown) => {
    calls.push({ model, method, args });
  };
  const customerRecord = () => users.find((user) => user.id === customerId);

  const client: Record<string, any> = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (item) => hashSessionToken(item.token) === where.tokenHash,
        );
        if (!session) return null;
        const user = users.find((item) => item.id === session.userId);
        if (!user) return null;
        const { token: _token, ...authenticatedUser } = user;
        return { expiresAt: session.expiresAt, user: authenticatedUser };
      },
      deleteMany: async (args: unknown) => {
        record("session", "deleteMany", args);
        const index = sessions.findIndex((item) => item.userId === customerId);
        if (index !== -1) sessions.splice(index, 1);
        return { count: 1 };
      },
    },
    user: {
      findFirst: async ({ where }: { where: { id: string; role: string } }) =>
        users.find(
          (user) => user.id === where.id && user.role === where.role,
        ) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        record("user", "update", { where, data });
        const user = users.find((item) => item.id === where.id);
        assert.ok(user);
        Object.assign(user, data);
        return user;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        record("user", "delete", { where });
        const index = users.findIndex((user) => user.id === where.id);
        assert.notEqual(index, -1);
        for (
          let sessionIndex = sessions.length - 1;
          sessionIndex >= 0;
          sessionIndex -= 1
        ) {
          if (sessions[sessionIndex]?.userId === where.id) {
            sessions.splice(sessionIndex, 1);
          }
        }
        return users.splice(index, 1)[0];
      },
    },
    repairOrder: {
      findMany: async (args: { select?: Record<string, unknown> }) => {
        if (args.select && "photos" in args.select) {
          return [
            {
              photos: [
                { objectId: "repair-photo" },
                { objectId: "shared-photo" },
              ],
              intake: {
                frontPhotoObjectId: "intake-photo",
                backPhotoObjectId: null,
                leftPhotoObjectId: null,
                rightPhotoObjectId: null,
              },
            },
          ];
        }
        return [{ id: repairOrderId }];
      },
    },
    shopOrder: {
      findMany: async () => [],
    },
    review: {
      findMany: async () => [{ imageObjectId: "review-photo" }],
    },
    craftOrder: {
      findMany: async (args: { select?: Record<string, unknown> }) =>
        args.select && "chatMessages" in args.select
          ? [{ chatMessages: [{ imageObjectId: "craft-chat-photo" }] }]
          : [{ id: craftOrderId }],
    },
    $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const query = strings.join("");
      if (query.includes("FOR UPDATE")) return [{ id: customerId }];
      return [{ referenced: values.at(-1) === "shared-photo" }];
    },
    $transaction: async (operation: (transaction: unknown) => unknown) =>
      operation(client),
  };

  for (const model of [
    "technicianSalaryEntry",
    "craftOrderReceipt",
    "craftOrderSalaryEntry",
    "supportConversation",
    "loyaltyTransaction",
    "customerReferral",
    "customerOfferParticipation",
    "gameEpisodeCompletion",
    "match3GameSession",
    "match3LevelCompletion",
    "match3LevelReward",
    "match3Inventory",
  ]) {
    client[model] = {
      deleteMany: async (args: unknown) => {
        record(model, "deleteMany", args);
        return { count: 1 };
      },
    };
  }
  for (const model of ["repairOrder", "craftOrder", "review"]) {
    client[model].deleteMany = async (args: unknown) => {
      record(model, "deleteMany", args);
      return { count: 1 };
    };
  }

  const storage = {
    upload: async () => "unused",
    download: async () => ({
      bytes: Buffer.alloc(0),
      contentType: "image/jpeg",
    }),
    delete: async (objectId: string) => {
      if (objectId === failOnceFor && !failedOnce) {
        failedOnce = true;
        throw new Error("storage temporarily unavailable");
      }
      storageDeleted.add(objectId);
    },
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCustomerAdminRouter(client as unknown as DatabaseClient, storage),
  );
  app.use(errorHandler);

  return {
    app,
    calls,
    customer: customerRecord,
    storageDeleted,
    sessions,
    tokens,
    users,
  };
};

const startServer = async (
  app: express.Express,
  after: (callback: () => void) => void,
) => {
  const server = app.listen(0);
  await once(server, "listening");
  after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}/api`;
};

test("admins can delete a customer and all of their linked records and media", async (t) => {
  const harness = createHarness();
  const baseUrl = await startServer(harness.app, t.after.bind(t));
  const endpoint = `${baseUrl}/admin/customers/${customerId}`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });

  const denied = await fetch(endpoint, {
    method: "DELETE",
    headers: headers(harness.tokens.customer),
  });
  assert.equal(denied.status, 403);
  assert.ok(harness.customer());

  const removed = await fetch(endpoint, {
    method: "DELETE",
    headers: headers(harness.tokens.admin),
  });
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), {
    customer: {
      id: customerId,
      email: "client@example.test",
      displayName: "Клиент",
    },
  });
  assert.equal(harness.customer(), undefined);
  assert.equal(
    harness.users.some((user) => user.role === "ADMIN"),
    true,
  );
  assert.deepEqual(
    [...harness.storageDeleted].sort(),
    [
      "avatar-photo",
      "craft-chat-photo",
      "intake-photo",
      "repair-photo",
      "review-photo",
    ].sort(),
  );

  const deletedTables = harness.calls
    .filter((call) => call.method === "deleteMany")
    .map((call) => call.model);
  for (const model of [
    "technicianSalaryEntry",
    "craftOrderReceipt",
    "craftOrderSalaryEntry",
    "repairOrder",
    "craftOrder",
    "review",
    "supportConversation",
    "loyaltyTransaction",
    "customerReferral",
    "customerOfferParticipation",
    "gameEpisodeCompletion",
    "match3GameSession",
    "match3LevelCompletion",
    "match3LevelReward",
    "match3Inventory",
  ]) {
    assert.ok(deletedTables.includes(model), `${model} should be cleaned up`);
  }
  const userDeleteIndex = harness.calls.findIndex(
    (call) => call.model === "user" && call.method === "delete",
  );
  assert.ok(userDeleteIndex > 0);
  assert.ok(
    harness.calls
      .slice(0, userDeleteIndex)
      .some(
        (call) => call.model === "repairOrder" && call.method === "deleteMany",
      ),
  );
});

test("a failed photo cleanup disables access and allows the admin to retry deletion", async (t) => {
  const harness = createHarness("review-photo");
  const baseUrl = await startServer(harness.app, t.after.bind(t));
  const endpoint = `${baseUrl}/admin/customers/${customerId}`;
  const headers = { authorization: `Bearer ${harness.tokens.admin}` };

  const firstAttempt = await fetch(endpoint, {
    method: "DELETE",
    headers,
  });
  assert.equal(firstAttempt.status, 503);
  assert.equal(harness.customer()?.active, false);
  assert.ok(harness.customer());
  assert.equal(
    harness.calls.some(
      (call) => call.model === "user" && call.method === "delete",
    ),
    false,
  );

  const retry = await fetch(endpoint, { method: "DELETE", headers });
  assert.equal(retry.status, 200);
  assert.equal(harness.customer(), undefined);
  assert.ok(harness.storageDeleted.has("review-photo"));
});

test("a customer can delete only their own account from the authenticated app session", async (t) => {
  const harness = createHarness();
  const baseUrl = await startServer(harness.app, t.after.bind(t));
  const endpoint = `${baseUrl}/customer/account`;

  const unauthenticated = await fetch(endpoint, { method: "DELETE" });
  assert.equal(unauthenticated.status, 401);
  assert.ok(harness.customer());

  const administrator = await fetch(endpoint, {
    method: "DELETE",
    headers: { authorization: `Bearer ${harness.tokens.admin}` },
  });
  assert.equal(administrator.status, 403);
  assert.ok(harness.customer());

  const otherAccount = await fetch(`${endpoint}/${adminId}`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${harness.tokens.customer}` },
  });
  assert.equal(otherAccount.status, 404);
  assert.ok(harness.customer());

  const deleted = await fetch(endpoint, {
    method: "DELETE",
    headers: { authorization: `Bearer ${harness.tokens.customer}` },
  });
  assert.equal(deleted.status, 200);
  assert.deepEqual(await deleted.json(), { deleted: true });
  assert.equal(harness.customer(), undefined);
  assert.ok(harness.users.some((user) => user.id === adminId));
  assert.equal(
    harness.sessions.some((session) => session.userId === customerId),
    false,
  );
});

test("a customer can retry self-deletion after temporary photo cleanup failure", async (t) => {
  const harness = createHarness("review-photo");
  const baseUrl = await startServer(harness.app, t.after.bind(t));
  const endpoint = `${baseUrl}/customer/account`;
  const headers = { authorization: `Bearer ${harness.tokens.customer}` };

  const firstAttempt = await fetch(endpoint, { method: "DELETE", headers });
  assert.equal(firstAttempt.status, 503);
  assert.equal(harness.customer()?.active, true);
  assert.equal(
    harness.sessions.some((session) => session.userId === customerId),
    true,
  );
  assert.equal(
    harness.calls.some(
      (call) => call.model === "session" && call.method === "deleteMany",
    ),
    false,
  );

  const retry = await fetch(endpoint, { method: "DELETE", headers });
  assert.equal(retry.status, 200);
  assert.equal(harness.customer(), undefined);
  assert.equal(
    harness.sessions.some((session) => session.userId === customerId),
    false,
  );
  assert.ok(harness.storageDeleted.has("review-photo"));
});
