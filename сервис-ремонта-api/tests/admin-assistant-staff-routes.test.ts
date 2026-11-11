import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createStaffRouter } from "../src/features/staff/staff.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("admin assistants can manage staff but cannot create full administrators", async (t) => {
  const adminToken = "A".repeat(48);
  const assistantToken = "H".repeat(48);
  const admin = makeUser("11111111-1111-4111-8111-111111111111", "ADMIN");
  const assistant = makeUser(
    "22222222-2222-4222-8222-222222222222",
    "ADMIN",
    true,
  );
  const terminated = {
    ...makeUser("33333333-3333-4333-8333-333333333333", "TECHNICIAN"),
    terminatedAt: new Date(),
  };
  const users = [admin, assistant, terminated];
  const sessions = [
    { token: adminToken, user: admin },
    { token: assistantToken, user: assistant },
  ];
  let nextId = 4;
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createStaffRouter({
      session: {
        findUnique: async ({ where }: { where: { tokenHash: string } }) => {
          const session = sessions.find(
            (item) => hashSessionToken(item.token) === where.tokenHash,
          );
          return session
            ? {
                expiresAt: new Date(Date.now() + 60_000),
                user: session.user,
              }
            : null;
        },
      },
      user: {
        findMany: async ({
          where,
        }: {
          where: { role: { in: string[] }; terminatedAt?: null };
        }) =>
          users.filter(
            (item) =>
              where.role.in.includes(item.role) &&
              (where.terminatedAt !== null || item.terminatedAt === null),
          ),
        create: async ({ data }: { data: Record<string, unknown> }) => {
          const created = {
            ...makeUser(
              `44444444-4444-4444-8444-${String(nextId++).padStart(12, "0")}`,
              String(data.role),
              Boolean(data.isAdminAssistant),
            ),
            ...data,
          };
          users.push(created as ReturnType<typeof makeUser>);
          return created;
        },
      },
    } as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/staff`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });
  const create = (token: string, role: string, email: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: headers(token),
      body: JSON.stringify({ email, displayName: "Новый сотрудник", role }),
    });

  const helperResponse = await create(
    adminToken,
    "ADMIN_ASSISTANT",
    "helper@example.test",
  );
  assert.equal(helperResponse.status, 201);
  const helperBody = (await helperResponse.json()) as {
    staff: { role: string; isAdminAssistant: boolean };
    temporaryPassword: string;
  };
  assert.equal(helperBody.staff.role, "ADMIN");
  assert.equal(helperBody.staff.isAdminAssistant, true);
  assert.equal(helperBody.temporaryPassword.length, 6);

  const blockedAdminResponse = await create(
    assistantToken,
    "ADMIN",
    "forbidden-admin@example.test",
  );
  assert.equal(blockedAdminResponse.status, 403);
  assert.equal(
    (await blockedAdminResponse.json()).error.code,
    "ADMIN_CREATION_FORBIDDEN",
  );

  const technicianResponse = await create(
    assistantToken,
    "TECHNICIAN",
    "new-tech@example.test",
  );
  assert.equal(technicianResponse.status, 201);

  const adminResponse = await create(
    adminToken,
    "ADMIN",
    "new-admin@example.test",
  );
  assert.equal(adminResponse.status, 201);
  const adminBody = (await adminResponse.json()) as {
    staff: { role: string; isAdminAssistant: boolean };
  };
  assert.equal(adminBody.staff.role, "ADMIN");
  assert.equal(adminBody.staff.isAdminAssistant, false);

  const listResponse = await fetch(endpoint, {
    headers: headers(assistantToken),
  });
  assert.equal(listResponse.status, 200);
  const listBody = (await listResponse.json()) as {
    staff: Array<{ id: string; isAdminAssistant: boolean }>;
  };
  assert.ok(listBody.staff.some((member) => member.isAdminAssistant));
  assert.equal(
    listBody.staff.some((member) => member.id === terminated.id),
    false,
  );
});

const makeUser = (id: string, role: string, isAdminAssistant = false) => ({
  id,
  email: `${id}@example.test`,
  login: null,
  displayName: role === "ADMIN" ? "Администратор" : "Сотрудник",
  phoneNumber: null,
  gender: null,
  birthDate: null,
  telegramChatId: null,
  maxUserId: null,
  avatarObjectId: null,
  role,
  isAdminAssistant,
  salaryRatePercent: 75,
  active: true,
  terminatedAt: null as Date | null,
  mustChangePassword: false,
  createdAt: new Date(),
});
