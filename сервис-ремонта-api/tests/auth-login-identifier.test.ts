import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import { hashPassword } from "../src/features/auth/passwords.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("a customer can sign in with the generated username and temporary password", async (t) => {
  const password = "temporary-password-for-test";
  const user = {
    id: "22222222-2222-4222-8222-222222222222",
    email: null,
    login: "a2b3c4d5",
    displayName: "Клиент",
    phoneNumber: "+79995550001",
    gender: null,
    birthDate: null,
    telegramChatId: null,
    maxUserId: "max-user-test-id",
    avatarObjectId: null,
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: true,
    passwordHash: await hashPassword(password),
  };
  let lookup: Record<string, unknown> | undefined;
  const database = {
    user: {
      findUnique: async ({ where }: { where: Record<string, unknown> }) => {
        lookup = where;
        return where.login === user.login ? user : null;
      },
    },
    session: {
      create: async ({ data }: { data: Record<string, unknown> }) => data,
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createAuthRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/auth/login`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "A2B3C4D5",
        password,
        portal: "CUSTOMER",
      }),
    },
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(lookup, { login: user.login });
  assert.equal(body.user.login, user.login);
  assert.equal(body.user.email, null);
  assert.equal(body.user.mustChangePassword, true);
  assert.equal(typeof body.accessToken, "string");
});
