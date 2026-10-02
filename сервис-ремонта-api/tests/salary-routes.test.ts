import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createSalaryRouter } from "../src/features/salary/salary.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("salary summaries are personal for technicians and administrator-only across staff", async (t) => {
  const tokens = {
    admin: "A".repeat(48),
    technician: "T".repeat(48),
    customer: "C".repeat(48),
  };
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "Администратор",
      role: "ADMIN" as const,
      token: tokens.admin,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Мастер один",
      role: "TECHNICIAN" as const,
      token: tokens.technician,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      displayName: "Клиент",
      role: "CUSTOMER" as const,
      token: tokens.customer,
    },
  ];
  const sessions = users.map((user) => ({
    expiresAt: new Date(Date.now() + 60_000),
    user: {
      id: user.id,
      email: `${user.role.toLowerCase()}@example.test`,
      displayName: user.displayName,
      phoneNumber: null,
      avatarObjectId: null,
      role: user.role,
      active: true,
      mustChangePassword: false,
    },
    token: user.token,
  }));
  let requestedTechnicianIds: string[] | undefined;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (candidate) => hashSessionToken(candidate.token) === where.tokenHash,
        );
        return session
          ? { expiresAt: session.expiresAt, user: session.user }
          : null;
      },
    },
    user: {
      findMany: async () => [
        { id: users[1]!.id, displayName: users[1]!.displayName },
        {
          id: "44444444-4444-4444-8444-444444444444",
          displayName: "Мастер два",
        },
      ],
    },
    technicianSalaryEntry: {
      findMany: async ({
        where,
      }: {
        where: { technicianId: { in: string[] } };
      }) => {
        requestedTechnicianIds = where.technicianId.in;
        return [
          {
            technicianId: users[1]!.id,
            earnedAt: new Date("2026-10-02T08:00:00.000Z"),
            salaryRub: 1_125,
          },
        ].filter((entry) =>
          requestedTechnicianIds?.includes(entry.technicianId),
        );
      },
    },
  };

  const app = express();
  app.use("/api", createSalaryRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/salary?timeZone=UTC`;
  const request = (token: string) =>
    fetch(baseUrl, { headers: { authorization: `Bearer ${token}` } });

  const technicianResponse = await request(tokens.technician);
  assert.equal(technicianResponse.status, 200);
  const technicianBody = await technicianResponse.json();
  assert.deepEqual(requestedTechnicianIds, [users[1]!.id]);
  assert.deepEqual(
    technicianBody.technicians.map((item: { id: string }) => item.id),
    [users[1]!.id],
  );
  assert.equal(technicianBody.totals.day, 1_125);
  assert.equal(technicianBody.totals.week, 1_125);
  assert.equal(technicianBody.totals.month, 1_125);

  const adminResponse = await request(tokens.admin);
  assert.equal(adminResponse.status, 200);
  const adminBody = await adminResponse.json();
  assert.equal(adminBody.technicians.length, 2);
  assert.equal(adminBody.totals.month, 1_125);

  assert.equal((await request(tokens.customer)).status, 403);
  const invalidTimeZone = await fetch(
    `${baseUrl.split("?")[0]}?timeZone=Invalid%2FZone`,
    { headers: { authorization: `Bearer ${tokens.admin}` } },
  );
  assert.equal(invalidTimeZone.status, 400);
});
