import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createStaffRouter } from "../src/features/staff/staff.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("administrators create staff with an ordinary login and a one-time six-character password", async (t) => {
  const token = "A".repeat(48);
  const admin = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.test",
    login: null,
    displayName: "Администратор",
    phoneNumber: null,
    gender: null,
    birthDate: null,
    telegramChatId: null,
    maxUserId: null,
    avatarObjectId: null,
    role: "ADMIN" as const,
    salaryRatePercent: 75,
    active: true,
    terminatedAt: null,
    mustChangePassword: false,
  };
  let createdData: Record<string, unknown> | undefined;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: admin }
          : null,
    },
    user: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData = data;
        return {
          ...admin,
          id: "22222222-2222-4222-8222-222222222222",
          ...data,
          active: true,
          mustChangePassword: true,
          createdAt: new Date(),
        };
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createStaffRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/staff`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      email: "technician@example.test",
      displayName: "Новый мастер",
      role: "TECHNICIAN",
    }),
  });

  assert.equal(response.status, 201);
  const result = await response.json();
  assert.match(result.staff.login, /^enot-[a-f0-9]{16}$/);
  assert.equal(result.temporaryPassword.length, 6);
  assert.equal(result.staff.mustChangePassword, true);
  assert.equal("passwordHash" in result.staff, false);
  assert.equal(createdData?.mustChangePassword, true);
  assert.equal(String(createdData?.passwordHash).startsWith("scrypt$"), true);
  assert.notEqual(createdData?.passwordHash, result.temporaryPassword);
});
