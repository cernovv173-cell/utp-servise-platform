import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createStaffRouter } from "../src/features/staff/staff.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("only administrators can permanently offboard staff without deleting history", async (t) => {
  const tokens = { admin: "A".repeat(48), customer: "C".repeat(48) };
  const adminId = "22222222-2222-4222-8222-222222222222";
  const technicianId = "11111111-1111-4111-8111-111111111111";
  const users = [
    {
      id: adminId,
      email: "admin@example.test",
      displayName: "Admin",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN" as const,
      active: true,
      terminatedAt: null as Date | null,
      terminatedById: null as string | null,
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
      terminatedAt: null,
      terminatedById: null,
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
      terminatedAt: null as Date | null,
      terminatedById: null as string | null,
      mustChangePassword: false,
      token: "T".repeat(48),
      createdAt: new Date(),
    },
  ];
  const sessions = users.map((user) => ({
    ...user,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const activeOrder = {
    id: "44444444-4444-4444-8444-444444444444",
    status: "IN_PROGRESS" as const,
    assignedTechnicianId: technicianId as string | null,
  };
  let revokedSessions = false;
  let statusEvents = 0;
  const transaction = {
    $queryRaw: async () => [{ id: technicianId }, { id: adminId }],
    user: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        users.find((item) => item.id === where.id) ?? null,
      count: async ({ where }: { where: { role: string; active: boolean } }) =>
        users.filter(
          (item) => item.role === where.role && item.active === where.active,
        ).length,
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
    repairOrder: {
      findMany: async () =>
        activeOrder.assignedTechnicianId ? [{ ...activeOrder }] : [],
      updateMany: async () => {
        activeOrder.assignedTechnicianId = null;
        return { count: 1 };
      },
    },
    repairStatusEvent: {
      createMany: async ({ data }: { data: unknown[] }) => {
        statusEvents += data.length;
        return { count: data.length };
      },
    },
    session: {
      deleteMany: async () => {
        revokedSessions = true;
        return { count: 1 };
      },
    },
    passwordResetToken: { deleteMany: async () => ({ count: 0 }) },
    pushDeviceToken: { deleteMany: async () => ({ count: 0 }) },
    maxLinkToken: { updateMany: async () => ({ count: 0 }) },
    maxLoginRequest: { updateMany: async () => ({ count: 0 }) },
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
  const baseUrl = `http://127.0.0.1:${address.port}/api/staff`;
  const endpoint = `${baseUrl}/${technicianId}`;
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
  assert.equal(blocked.status, 200);
  await blocked.json();
  assert.equal(users[2]!.active, false);
  assert.ok(users[2]!.terminatedAt);
  assert.equal(
    users.some((user) => user.id === technicianId),
    true,
  );
  assert.equal(activeOrder.assignedTechnicianId, null);
  assert.equal(statusEvents, 1);
  assert.equal(revokedSessions, true);

  const selfTermination = await fetch(`${baseUrl}/${adminId}/terminate`, {
    method: "POST",
    headers: headers(tokens.admin),
  });
  assert.equal(selfTermination.status, 409);
});
