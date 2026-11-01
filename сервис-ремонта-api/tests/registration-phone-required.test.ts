import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("registration rejects a missing or malformed phone before touching the database", async (t) => {
  let transactionCalls = 0;
  const client = {
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("Invalid registrations must not reach the database.");
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createAuthRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const endpoint = `http://127.0.0.1:${address.port}/api/auth/register`;
  const baseBody = {
    email: "phone-required@example.test",
    displayName: "Клиент без телефона",
    password: "ValidPassword123",
  };
  const phoneVariants: Array<Record<string, unknown>> = [
    {},
    { phoneNumber: null },
    { phoneNumber: "" },
    { phoneNumber: "   " },
    { phoneNumber: "call-me-anytime" },
    { phoneNumber: "+7 999" },
  ];

  for (const variant of phoneVariants) {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...baseBody, ...variant }),
    });
    assert.equal(response.status, 400, JSON.stringify(variant));
    assert.equal((await response.json()).error.code, "VALIDATION_ERROR");
  }

  assert.equal(transactionCalls, 0);
});
