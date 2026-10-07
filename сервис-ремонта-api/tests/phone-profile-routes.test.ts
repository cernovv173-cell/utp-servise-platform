import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createAuthRouter } from "../src/features/auth/auth.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("profile phone updates only the signed-in account and rejects malformed numbers", async (t) => {
  const sessionToken = "P".repeat(48);
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "phone-test@example.test",
    displayName: "Phone test",
    phoneNumber: null as string | null,
    gender: null as "MALE" | "FEMALE" | null,
    birthDate: null as Date | null,
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: false,
  };
  const updates: Array<Record<string, any>> = [];
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user }
          : null,
    },
    user: {
      update: async (input: Record<string, any>) => {
        updates.push(input);
        user.phoneNumber = input.data.phoneNumber;
        if (input.data.gender !== undefined) user.gender = input.data.gender;
        if (input.data.birthDate !== undefined)
          user.birthDate = input.data.birthDate;
        return user;
      },
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
  const endpoint = `http://127.0.0.1:${address.port}/api/auth/profile`;
  const headers = {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  };

  const update = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ phoneNumber: "+7 (999) 123-45-67" }),
  });
  assert.equal(update.status, 200);
  assert.equal((await update.json()).user.phoneNumber, "+7 (999) 123-45-67");
  assert.deepEqual(updates[0], {
    where: { id: user.id },
    data: { phoneNumber: "+7 (999) 123-45-67" },
  });

  const invalid = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ phoneNumber: "call-me-anytime" }),
  });
  assert.equal(invalid.status, 400);
  assert.equal(updates.length, 1);

  const omitted = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({}),
  });
  assert.equal(omitted.status, 400);
  assert.equal(updates.length, 1);

  const clear = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ phoneNumber: null }),
  });
  assert.equal(clear.status, 200);
  assert.equal((await clear.json()).user.phoneNumber, null);
  assert.equal(updates[1]?.where.id, user.id);

  const birthdayProfile = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      phoneNumber: null,
      gender: "FEMALE",
      birthDate: "1990-04-07",
    }),
  });
  assert.equal(birthdayProfile.status, 200);
  const birthdayUser = (await birthdayProfile.json()).user;
  assert.equal(birthdayUser.gender, "FEMALE");
  assert.equal(birthdayUser.birthDate, "1990-04-07");
  assert.equal(updates[2]?.data.gender, "FEMALE");
  assert.equal(
    updates[2]?.data.birthDate.toISOString(),
    "1990-04-07T00:00:00.000Z",
  );

  const futureBirthday = await fetch(endpoint, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ phoneNumber: null, birthDate: "2999-01-01" }),
  });
  assert.equal(futureBirthday.status, 400);
  assert.equal(updates.length, 3);
});
