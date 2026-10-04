import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("order number search returns only records available to the signed-in role", async (t) => {
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "admin@example.test",
      displayName: "Admin",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: "A".repeat(48),
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "customer@example.test",
      displayName: "Customer",
      phoneNumber: "+7 999 123-45-67",
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: "C".repeat(48),
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "tech@example.test",
      displayName: "Technician",
      phoneNumber: null,
      avatarObjectId: null,
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: "T".repeat(48),
    },
  ];
  const calls: Array<Record<string, any>> = [];
  const databaseClient = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        if (!user) return null;
        const { token: _token, ...sessionUser } = user;
        return { expiresAt: new Date(Date.now() + 60_000), user: sessionUser };
      },
    },
    repairOrder: {
      findMany: async (input: Record<string, any>) => {
        calls.push(input);
        return [];
      },
    },
  };
  const app = express();
  app.use(
    "/api",
    createOrdersRouter(databaseClient as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders/search?serviceNumber=SRV-2026`;

  for (const user of users) {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).orders, []);
  }

  assert.deepEqual(calls[0]?.where, {
    serviceNumber: { contains: "SRV-2026", mode: "insensitive" },
  });
  assert.deepEqual(calls[1]?.where, {
    customerId: users[1]!.id,
    serviceNumber: { contains: "SRV-2026", mode: "insensitive" },
  });
  assert.equal(calls[1]?.include.customer.select.phoneNumber, false);
  assert.deepEqual(calls[2]?.where, {
    assignedTechnicianId: users[2]!.id,
    serviceNumber: { contains: "SRV-2026", mode: "insensitive" },
  });
});
