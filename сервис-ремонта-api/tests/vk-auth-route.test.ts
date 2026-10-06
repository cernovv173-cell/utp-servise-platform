import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("VK login verifies the provider identity and creates a customer session", async (t) => {
  const users: Array<Record<string, unknown>> = [];
  const sessions: Array<Record<string, unknown>> = [];
  const database = {
    user: {
      findUnique: async ({ where }: { where: Record<string, string> }) =>
        users.find((user) =>
          Object.entries(where).every(([key, value]) => user[key] === value),
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const user = {
          id: "33333333-3333-4333-8333-333333333333",
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
      vkAppId: "54808157",
      fetchVkIdentity: async (accessToken, appId) => {
        assert.equal(accessToken, "vk-oauth-access-token-for-test");
        assert.equal(appId, "54808157");
        return {
          id: "vk-user-123",
          email: "customer@example.test",
          displayName: "VK Customer",
        };
      },
    }),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/auth/vk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: "vk-oauth-access-token-for-test",
      portal: "CUSTOMER",
    }),
  });

  assert.equal(response.status, 200);
  const result = (await response.json()) as {
    accessToken: string;
    user: { role: string; email: string };
  };
  assert.equal(result.user.role, "CUSTOMER");
  assert.equal(result.user.email, "customer@example.test");
  assert.match(result.accessToken, /^[A-Za-z0-9_-]{40,}$/u);
  assert.equal(users[0]?.vkId, "vk-user-123");
  assert.equal(users[0]?.role, "CUSTOMER");
  assert.equal(sessions.length, 1);
});
