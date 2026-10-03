import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import {
  hashPassword,
  verifyPassword,
} from "../src/features/auth/passwords.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

for (const role of ["CUSTOMER", "TECHNICIAN", "ADMIN"] as const) {
  test(`${role} can securely change their own password and renew the session`, async (t) => {
    const token = `${role}-`.padEnd(48, "T");
    const user = {
      id: `user-${role}`,
      email: `${role.toLowerCase()}@test.invalid`,
      displayName: role,
      phoneNumber: null,
      avatarObjectId: null,
      role,
      active: true,
      mustChangePassword: false,
      passwordHash: await hashPassword("Current-password-123"),
    };
    let deletedSessionsFor: string | undefined;
    let renewedSessionUserId: string | undefined;
    let currentSessionValid = true;
    const client = {
      session: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) =>
          currentSessionValid && where.tokenHash === hashSessionToken(token)
            ? { expiresAt: new Date(Date.now() + 60_000), user }
            : null,
        deleteMany: async ({ where }: { where: { userId: string } }) => {
          deletedSessionsFor = where.userId;
          currentSessionValid = false;
          return { count: 1 };
        },
        create: async ({ data }: { data: { userId: string } }) => {
          renewedSessionUserId = data.userId;
          return data;
        },
      },
      user: {
        findUnique: async ({ where }: { where: { id: string } }) =>
          where.id === user.id ? user : null,
        update: async ({
          where,
          data,
        }: {
          where: { id: string };
          data: { passwordHash: string; mustChangePassword: boolean };
        }) => {
          assert.equal(where.id, user.id);
          Object.assign(user, data);
          return user;
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
    const endpoint = `http://127.0.0.1:${address.port}/api/auth/change-password`;
    const headers = {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    };

    const rejected = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        currentPassword: "incorrect-current-password",
        newPassword: "New-password-456",
      }),
    });
    assert.equal(rejected.status, 401);
    assert.equal(
      await verifyPassword("Current-password-123", user.passwordHash),
      true,
    );

    const tooShort = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        currentPassword: "Current-password-123",
        newPassword: "short7",
      }),
    });
    assert.equal(tooShort.status, 400);
    assert.equal(
      await verifyPassword("Current-password-123", user.passwordHash),
      true,
    );

    const changed = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        currentPassword: "Current-password-123",
        newPassword: "New-pass-8",
      }),
    });
    assert.equal(changed.status, 200);
    const result = await changed.json();
    assert.equal(result.user.role, role);
    assert.equal(result.user.mustChangePassword, false);
    assert.equal(await verifyPassword("New-pass-8", user.passwordHash), true);
    assert.equal(deletedSessionsFor, user.id);
    assert.equal(renewedSessionUserId, user.id);
    assert.equal(typeof result.accessToken, "string");
  });
}
