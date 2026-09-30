import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("order phone details are loaded only through role-scoped order lists", async (t) => {
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      role: "CUSTOMER" as const,
      phoneNumber: "",
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      role: "TECHNICIAN" as const,
      phoneNumber: "",
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      role: "ADMIN" as const,
      phoneNumber: "",
    },
  ].map((entry, index) => ({
    ...entry,
    email: `user-${index}@example.test`,
    displayName: `User ${index}`,
    active: true,
    mustChangePassword: false,
    token: String(index + 1).repeat(48),
  }));
  const order = {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    customer: {
      id: users[0]!.id,
      displayName: "Customer",
      phoneNumber: "+7 900 000-00-01",
    },
    assignedTechnician: {
      id: users[1]!.id,
      displayName: "Technician",
      phoneNumber: "+7 900 000-00-02",
    },
  };
  const calls: Array<Record<string, any>> = [];
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    repairOrder: {
      findMany: async (input: Record<string, any>) => {
        calls.push(input);
        return [order];
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createOrdersRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders`;

  for (const user of users) {
    const response = await fetch(endpoint, {
      headers: { authorization: `Bearer ${user.token}` },
    });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(
      body.orders[0].customer.phoneNumber,
      order.customer.phoneNumber,
    );
    assert.equal(
      body.orders[0].assignedTechnician.phoneNumber,
      order.assignedTechnician.phoneNumber,
    );
  }

  assert.deepEqual(calls[0]?.where, { customerId: users[0]!.id });
  assert.deepEqual(calls[1]?.where, { assignedTechnicianId: users[1]!.id });
  assert.deepEqual(calls[2]?.where, {});
  assert.equal(calls[0]?.include.customer.select.phoneNumber, false);
  assert.equal(calls[0]?.include.assignedTechnician.select.phoneNumber, true);
  assert.equal(calls[1]?.include.customer.select.phoneNumber, true);
  assert.equal(calls[1]?.include.assignedTechnician.select.phoneNumber, false);
  assert.equal(calls[2]?.include.customer.select.phoneNumber, true);
  assert.equal(calls[2]?.include.assignedTechnician.select.phoneNumber, true);
});
