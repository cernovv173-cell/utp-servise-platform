import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createStaffRouter } from "../src/features/staff/staff.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("only administrators can edit technician profiles and individual salary rates", async (t) => {
  const tokens = {
    admin: "A".repeat(48),
    technician: "T".repeat(48),
    customer: "C".repeat(48),
  };
  const staffId = "11111111-1111-4111-8111-111111111111";
  const admin = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "admin@example.test",
    displayName: "Admin",
    phoneNumber: null,
    avatarObjectId: null,
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  const technician = {
    id: staffId,
    email: "tech@example.test",
    displayName: "Мастер",
    phoneNumber: null as string | null,
    avatarObjectId: null,
    role: "TECHNICIAN" as const,
    salaryRatePercent: 75,
    active: true,
    mustChangePassword: false,
    createdAt: new Date(),
  };
  const customer = {
    ...admin,
    id: "33333333-3333-4333-8333-333333333333",
    email: "customer@example.test",
    role: "CUSTOMER" as const,
  };
  const sessions = [
    { ...admin, token: tokens.admin },
    { ...technician, token: tokens.technician },
    { ...customer, token: tokens.customer },
  ];
  const updates: Array<Record<string, unknown>> = [];
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return session
          ? { expiresAt: new Date(Date.now() + 60_000), user: session }
          : null;
      },
    },
    user: {
      findFirst: async ({ where }: { where: { id: string; role: string } }) =>
        where.id === technician.id && where.role === technician.role
          ? { id: technician.id }
          : null,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        updates.push(data);
        Object.assign(technician, data);
        return technician;
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
  const endpoint = `http://127.0.0.1:${address.port}/api/staff/${staffId}`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const saved = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.admin),
    body: JSON.stringify({
      displayName: "Новый мастер",
      phoneNumber: "+7 999 123-45-67",
      salaryRatePercent: 62,
    }),
  });
  assert.equal(saved.status, 200);
  const savedBody = await saved.json();
  assert.equal(savedBody.staff.phoneNumber, "+7 999 123-45-67");
  assert.equal(savedBody.staff.salaryRatePercent, 62);
  assert.deepEqual(updates, [
    {
      displayName: "Новый мастер",
      phoneNumber: "+7 999 123-45-67",
      salaryRatePercent: 62,
    },
  ]);

  const forbidden = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.customer),
    body: JSON.stringify({ displayName: "Нельзя" }),
  });
  assert.equal(forbidden.status, 403);

  const invalidPhone = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.admin),
    body: JSON.stringify({ phoneNumber: "позвони мне" }),
  });
  assert.equal(invalidPhone.status, 400);
  assert.equal(updates.length, 1);

  const invalidRate = await fetch(endpoint, {
    method: "PATCH",
    headers: headers(tokens.admin),
    body: JSON.stringify({ salaryRatePercent: 101 }),
  });
  assert.equal(invalidRate.status, 400);
  assert.equal(updates.length, 1);
});
