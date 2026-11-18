import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerFeedbackRouter } from "../src/features/customer-feedback/customer-feedback.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("customer feedback is private, validated, and its status is admin-managed", async (t) => {
  const users = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      displayName: "Администратор",
      email: "admin@example.test",
      phoneNumber: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: "A".repeat(48),
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      displayName: "Клиент",
      email: "client@example.test",
      phoneNumber: "+7 999 000-00-00",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: "C".repeat(48),
    },
    {
      id: "33333333-3333-4333-8333-333333333333",
      displayName: "Мастер",
      email: "staff@example.test",
      phoneNumber: null,
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: "T".repeat(48),
    },
  ];
  const sessions = users.map((user) => ({
    user,
    expiresAt: new Date(Date.now() + 60_000),
  }));
  const submissions: Array<Record<string, any>> = [];
  const userById = new Map(users.map((user) => [user.id, user]));
  const withCustomer = (entry: Record<string, any>) => ({
    ...entry,
    customer: userById.get(entry.customerId),
  });
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = sessions.find(
          ({ user }) => hashSessionToken(user.token) === where.tokenHash,
        );
        if (!session) return null;
        const { token: _token, ...user } = session.user;
        return { expiresAt: session.expiresAt, user };
      },
    },
    customerFeedback: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: "44444444-4444-4444-8444-444444444444",
          status: "NEW",
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        submissions.push(created);
        return created;
      },
      findMany: async () =>
        [...submissions]
          .sort(
            (left, right) =>
              right.createdAt.getTime() - left.createdAt.getTime(),
          )
          .map(withCustomer),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const entry = submissions.find(({ id }) => id === where.id);
        if (!entry) return { count: 0 };
        Object.assign(entry, data);
        return { count: 1 };
      },
      findUnique: async ({ where }: { where: { id: string } }) => {
        const entry = submissions.find(({ id }) => id === where.id);
        return entry ? withCustomer(entry) : null;
      },
    },
  };

  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCustomerFeedbackRouter(client as unknown as DatabaseClient),
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

  const invalid = await fetch(`${baseUrl}/customer/feedback`, {
    method: "POST",
    headers: headers(users[1]!.token),
    body: JSON.stringify({ type: "OTHER", content: "Текст" }),
  });
  assert.equal(invalid.status, 400);

  const submitted = await fetch(`${baseUrl}/customer/feedback`, {
    method: "POST",
    headers: headers(users[1]!.token),
    body: JSON.stringify({
      type: "COMPLAINT",
      content: "  Прошу проверить заказ.  ",
    }),
  });
  assert.equal(submitted.status, 201);
  const created = (await submitted.json()).feedback;
  assert.equal(created.content, "Прошу проверить заказ.");
  assert.equal(created.status, "NEW");
  assert.equal(submitted.headers.get("cache-control"), "no-store");

  const inbox = await fetch(`${baseUrl}/admin/feedback`, {
    headers: headers(users[0]!.token),
  });
  assert.equal(inbox.status, 200);
  assert.equal((await inbox.json()).feedback[0].customer.displayName, "Клиент");

  const customerCannotReadInbox = await fetch(`${baseUrl}/admin/feedback`, {
    headers: headers(users[1]!.token),
  });
  assert.equal(customerCannotReadInbox.status, 403);

  const staffCannotChangeStatus = await fetch(
    `${baseUrl}/admin/feedback/${created.id}/status`,
    {
      method: "PATCH",
      headers: headers(users[2]!.token),
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    },
  );
  assert.equal(staffCannotChangeStatus.status, 403);

  const updated = await fetch(
    `${baseUrl}/admin/feedback/${created.id}/status`,
    {
      method: "PATCH",
      headers: headers(users[0]!.token),
      body: JSON.stringify({ status: "IN_PROGRESS" }),
    },
  );
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).feedback.status, "IN_PROGRESS");
});
