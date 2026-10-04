import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("order list can request active and archived records", async (t) => {
  const token = "4".repeat(48);
  const user = {
    id: "33333333-3333-4333-8333-333333333333",
    email: "admin@example.test",
    displayName: "Admin",
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  const calls: Array<Record<string, any>> = [];
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user }
          : null,
    },
    repairOrder: {
      findMany: async (input: Record<string, any>) => {
        calls.push(input);
        return [];
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

  for (const archive of ["active", "archived"] as const) {
    const response = await fetch(`${endpoint}?archive=${archive}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(response.status, 200);
  }
  assert.deepEqual(calls[0]?.where, { archivedAt: null });
  assert.deepEqual(calls[1]?.where, { archivedAt: { not: null } });

  const invalid = await fetch(`${endpoint}?archive=unknown`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(invalid.status, 400);
});
