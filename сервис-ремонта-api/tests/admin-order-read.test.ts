import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("only administrators can load an individual repair order for its detail page", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const adminToken = "A".repeat(48);
  const customerToken = "C".repeat(48);
  const order = { id: orderId, serviceNumber: "SRV-2026-000001" };
  const users = [
    {
      id: "22222222-2222-4222-8222-222222222222",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
  ];
  let include: unknown;
  const database = {
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
      findUnique: async ({
        where,
        include: selected,
      }: {
        where: { id: string };
        include: unknown;
      }) => {
        include = selected;
        return where.id === orderId ? order : null;
      },
    },
  };
  const app = express();
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/admin/orders/${orderId}`;

  const adminResponse = await fetch(endpoint, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(adminResponse.status, 200);
  assert.deepEqual((await adminResponse.json()).order, order);
  assert.ok(include);

  const customerResponse = await fetch(endpoint, {
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert.equal(customerResponse.status, 403);

  const missingResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/admin/orders/44444444-4444-4444-8444-444444444444`,
    { headers: { authorization: `Bearer ${adminToken}` } },
  );
  assert.equal(missingResponse.status, 404);
});
