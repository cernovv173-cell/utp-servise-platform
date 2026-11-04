import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";

test("legacy QR pickup endpoints are no longer available", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api", createOrdersRouter({} as unknown as DatabaseClient));
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  const pickupCode = await fetch(
    `${baseUrl}/orders/11111111-1111-4111-8111-111111111111/pickup-code`,
    { method: "POST" },
  );
  const closeByQr = await fetch(`${baseUrl}/orders/close-by-qr`, {
    method: "POST",
  });

  assert.equal(pickupCode.status, 404);
  assert.equal(closeByQr.status, 404);
});
