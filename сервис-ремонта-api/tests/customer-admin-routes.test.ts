import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerAdminRouter } from "../src/features/customers/customer.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("admins can create customers with forced password rotation and manage their contacts", async (t) => {
  const tokens = { admin: "A".repeat(48), customer: "C".repeat(48) };
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      email: "admin@example.test",
      displayName: "Admin",
      phoneNumber: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: tokens.admin,
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      email: "client@example.test",
      displayName: "Клиент",
      phoneNumber: null as string | null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      email: "second@example.test",
      displayName: "Второй клиент",
      phoneNumber: null as string | null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
    },
  ];
  const sessions = [
    { ...users[0], expiresAt: new Date(Date.now() + 60_000) },
    {
      ...users[1],
      token: tokens.customer,
      expiresAt: new Date(Date.now() + 60_000),
    },
  ];
  let lastListArgs: Record<string, any> | undefined;
  let lastUpdate: Record<string, unknown> | undefined;
  let lastCreate: Record<string, unknown> | undefined;
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          (item) => hashSessionToken(item.token) === where.tokenHash,
        );
        if (!session) return null;
        const { token: _token, ...user } = session;
        return { expiresAt: session.expiresAt, user };
      },
    },
    user: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        lastCreate = data;
        return {
          id: "44444444-4444-4444-8444-444444444444",
          email: data.email,
          displayName: data.displayName,
          phoneNumber: data.phoneNumber,
          active: true,
          createdAt: new Date(),
        };
      },
      findMany: async (args: Record<string, any>) => {
        lastListArgs = args;
        return users
          .filter((user) => user.role === "CUSTOMER")
          .slice(args.skip, args.skip + args.take)
          .map(({ id, email, displayName, phoneNumber, active }) => ({
            id,
            email,
            displayName,
            phoneNumber,
            active,
            createdAt: new Date(),
          }));
      },
      count: async () => 2,
      findFirst: async ({ where }: { where: { id: string; role: string } }) => {
        const user = users.find(
          (item) => item.id === where.id && item.role === where.role,
        );
        return user ? { id: user.id } : null;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        lastUpdate = data;
        const user = users.find((item) => item.id === where.id);
        assert.ok(user && user.role === "CUSTOMER");
        Object.assign(user, data);
        return {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          phoneNumber: user.phoneNumber,
          active: user.active,
          createdAt: new Date(),
        };
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCustomerAdminRouter(client as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const created = await fetch(`${baseUrl}/admin/customers`, {
    method: "POST",
    headers: headers(tokens.admin),
    body: JSON.stringify({
      displayName: "Новый клиент",
      email: "NEW@example.test",
      phoneNumber: "+7 999 123-45-67",
    }),
  });
  assert.equal(created.status, 201);
  const createdBody = await created.json();
  assert.equal(createdBody.customer.email, "new@example.test");
  assert.equal(createdBody.customer.displayName, "Новый клиент");
  assert.equal("passwordHash" in createdBody.customer, false);
  assert.ok(createdBody.temporaryPassword.length >= 20);
  assert.equal(lastCreate?.role, "CUSTOMER");
  assert.equal(lastCreate?.mustChangePassword, true);
  assert.equal(String(lastCreate?.passwordHash).startsWith("scrypt$"), true);

  const listed = await fetch(
    `${baseUrl}/admin/customers?search=client&page=2&pageSize=1`,
    { headers: headers(tokens.admin) },
  );
  assert.equal(listed.status, 200);
  const listBody = await listed.json();
  assert.equal(listBody.pagination.page, 2);
  assert.equal(listBody.pagination.totalItems, 2);
  assert.equal(lastListArgs?.skip, 1);
  assert.equal(lastListArgs?.take, 1);
  assert.equal("passwordHash" in listBody.customers[0], false);

  const customerId = users[1]!.id;
  const updated = await fetch(`${baseUrl}/admin/customers/${customerId}`, {
    method: "PATCH",
    headers: headers(tokens.admin),
    body: JSON.stringify({
      email: "new@example.test",
      displayName: "Новое имя",
      phoneNumber: "+7 999 123-45-67",
    }),
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).customer.displayName, "Новое имя");
  assert.deepEqual(lastUpdate, {
    email: "new@example.test",
    displayName: "Новое имя",
    phoneNumber: "+7 999 123-45-67",
  });

  const denied = await fetch(`${baseUrl}/admin/customers`, {
    headers: headers(tokens.customer),
  });
  assert.equal(denied.status, 403);
});
