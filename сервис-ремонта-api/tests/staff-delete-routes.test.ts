import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createStaffRouter } from "../src/features/staff/staff.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("only administrators can remove a technician, and unfinished jobs block removal", async (t) => {
  const tokens = { admin: "A".repeat(48), customer: "C".repeat(48) };
  const technicianId = "11111111-1111-4111-8111-111111111111";
  const users = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "admin@example.test",
      displayName: "Admin",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.admin,
      createdAt: new Date(),
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "customer@example.test",
      displayName: "Клиент",
      phoneNumber: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.customer,
    },
    {
      id: technicianId,
      email: "tech@example.test",
      displayName: "Мастер",
      phoneNumber: null,
      avatarObjectId: null,
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: "T".repeat(48),
      createdAt: new Date(),
    },
  ];
  const sessions = users.map((user) => ({
    ...user,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  let activeAssignments = 1;
  let revokedSessions = false;
  const transaction = {
    $queryRaw: async () => [{ id: technicianId }],
    user: {
      findFirst: async ({ where }: { where: { id: string; role: string } }) => {
        const user = users.find(
          (item) => item.id === where.id && item.role === where.role,
        );
        return user ?? null;
      },
      delete: async ({ where }: { where: { id: string } }) => {
        const index = users.findIndex((item) => item.id === where.id);
        assert.notEqual(index, -1);
        const [removed] = users.splice(index, 1);
        const sessionIndex = sessions.findIndex(
          (session) => session.id === where.id,
        );
        if (sessionIndex !== -1) sessions.splice(sessionIndex, 1);
        revokedSessions = true;
        return removed;
      },
    },
    repairOrder: { count: async () => activeAssignments },
  };
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (item) => hashSessionToken(item.token) === where.tokenHash,
        );
        if (!session) return null;
        const { token: _token, ...user } = session;
        return { expiresAt: session.expiresAt, user };
      },
      deleteMany: async () => {
        revokedSessions = true;
        return { count: 1 };
      },
    },
    user: {
      findFirst: async ({ where }: { where: { id: string; role: string } }) => {
        const user = users.find(
          (item) => item.id === where.id && item.role === where.role,
        );
        return user ?? null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const user = users.find((item) => item.id === where.id);
        assert.ok(user);
        Object.assign(user, data);
        return { ...user };
      },
    },
    repairOrder: { count: async () => activeAssignments },
    $transaction: async <T>(
      operation: (tx: typeof transaction) => Promise<T>,
    ) => operation(transaction),
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createStaffRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/staff/${technicianId}`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const customerAttempt = await fetch(endpoint, {
    method: "DELETE",
    headers: headers(tokens.customer),
  });
  assert.equal(customerAttempt.status, 403);

  const blocked = await fetch(endpoint, {
    method: "DELETE",
    headers: headers(tokens.admin),
  });
  assert.equal(blocked.status, 409);
  assert.equal(users[2]!.active, true);
  assert.equal(revokedSessions, false);

  activeAssignments = 0;
  const removed = await fetch(endpoint, {
    method: "DELETE",
    headers: headers(tokens.admin),
  });
  assert.equal(removed.status, 200);
  assert.equal((await removed.json()).staff.active, false);
  assert.equal(
    users.some((user) => user.id === technicianId),
    false,
  );
  assert.equal(revokedSessions, true);
});
