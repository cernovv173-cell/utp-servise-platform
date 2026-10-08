import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCraftsRouter } from "../src/features/crafts/crafts.routes.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("customers cannot redeem bonuses for repair or product orders", async (t) => {
  const token = "C".repeat(48);
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "customer@example.test",
    displayName: "Customer",
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: false,
  };
  let transactionCalls = 0;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user }
          : null,
    },
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("A customer request must not enter a transaction.");
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
  app.use("/api", createCraftsRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  const repairResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/22222222-2222-4222-8222-222222222222/bonus-redemption`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ redeemBonuses: true }),
    },
  );
  const craftResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/craft-orders/33333333-3333-4333-8333-333333333333/bonus-redemption`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ redeemBonuses: true }),
    },
  );

  assert.equal(repairResponse.status, 403);
  assert.equal(craftResponse.status, 403);
  assert.equal(transactionCalls, 0);
});
