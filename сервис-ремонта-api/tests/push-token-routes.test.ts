import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import {
  createRequireAuth,
  hashSessionToken,
} from "../src/features/auth/auth.middleware.js";
import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("signed-in users can register and remove only their own push device token", async (t) => {
  const sessionToken = "S".repeat(48);
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "push-test@example.test",
    displayName: "Push test",
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: false,
  };
  let registered: Record<string, unknown> | undefined;
  let removed: Record<string, unknown> | undefined;
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user }
          : null,
    },
    pushDeviceToken: {
      upsert: async (input: Record<string, unknown>) => {
        registered = input;
        return {};
      },
      deleteMany: async (input: Record<string, unknown>) => {
        removed = input;
        return { count: 1 };
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createAuthRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/auth/push-token`;
  const headers = {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  };

  const registration = await fetch(endpoint, {
    method: "PUT",
    headers,
    body: JSON.stringify({ token: "firebase-device-token" }),
  });
  assert.equal(registration.status, 204);
  assert.deepEqual(registered, {
    where: { token: "firebase-device-token" },
    create: { token: "firebase-device-token", userId: user.id },
    update: { userId: user.id },
  });

  const removal = await fetch(endpoint, {
    method: "DELETE",
    headers,
    body: JSON.stringify({ token: "firebase-device-token" }),
  });
  assert.equal(removal.status, 204);
  assert.deepEqual(removed, {
    where: { token: "firebase-device-token", userId: user.id },
  });
});
