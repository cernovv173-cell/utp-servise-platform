import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("only admins create repair orders for active customers and creation is audited", async (t) => {
  const adminToken = "A".repeat(48);
  const customerToken = "C".repeat(48);
  const adminId = "11111111-1111-4111-8111-111111111111";
  const customerId = "22222222-2222-4222-8222-222222222222";
  const orderId = "33333333-3333-4333-8333-333333333333";
  const users = [
    {
      id: adminId,
      email: "admin@example.test",
      displayName: "Admin",
      phoneNumber: null,
      avatarObjectId: null,
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: customerId,
      email: "customer@example.test",
      displayName: "Клиент",
      phoneNumber: "+7 999 123-45-67",
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
  ];
  let activeCustomer = true;
  let createdData: Record<string, unknown> | undefined;
  let statusEvent: Record<string, unknown> | undefined;
  const databaseClient = {
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
    user: {
      findFirst: async () =>
        activeCustomer
          ? { id: customerId, phoneNumber: users[1]!.phoneNumber }
          : null,
    },
    $queryRaw: async () => [{ value: 81n }],
    repairOrder: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData = data;
        return { id: orderId };
      },
      findUniqueOrThrow: async () => ({
        id: orderId,
        customerId,
        assignedTechnicianId: null,
      }),
    },
    repairStatusEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        statusEvent = data;
        return data;
      },
    },
    $transaction: async <T>(operation: (transaction: unknown) => Promise<T>) =>
      operation(databaseClient),
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createOrdersRouter(databaseClient as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/admin/orders`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });
  const body = {
    customerId,
    deviceType: "PHONE",
    problem: "Телефон не включается",
    city: "Москва",
    street: "Тестовая",
    house: "1",
  };

  const created = await fetch(endpoint, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify(body),
  });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).order.id, orderId);
  assert.equal(createdData?.customerId, customerId);
  assert.equal(createdData?.contactPhone, users[1]!.phoneNumber);
  assert.equal(createdData?.repairLocation, null);
  assert.equal(statusEvent?.actorId, adminId);
  assert.equal(statusEvent?.note, "Заявка создана администратором");

  const withoutAddress = await fetch(endpoint, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify({
      customerId,
      deviceType: "PHONE",
      problem: "Телефон не включается",
      repairLocation: "SERVICE_CENTER",
      city: "",
      street: "",
      house: "",
    }),
  });
  assert.equal(withoutAddress.status, 201);
  assert.equal(createdData?.address, "");
  assert.equal(createdData?.city, null);
  assert.equal(createdData?.street, null);
  assert.equal(createdData?.house, null);

  const customerOrder = await fetch(
    endpoint.replace("/admin/orders", "/orders"),
    {
      method: "POST",
      headers: headers(customerToken),
      body: JSON.stringify({
        deviceType: "PHONE",
        problem: "Телефон не включается",
        contactPhone: users[1]!.phoneNumber,
      }),
    },
  );
  assert.equal(customerOrder.status, 201);
  assert.equal(createdData?.address, "");
  assert.equal(createdData?.city, null);
  assert.equal(createdData?.street, null);
  assert.equal(createdData?.house, null);

  for (const repairLocation of [
    "CUSTOMER_ADDRESS",
    "SERVICE_CENTER",
  ] as const) {
    const locationOrder = await fetch(endpoint, {
      method: "POST",
      headers: headers(adminToken),
      body: JSON.stringify({ ...body, repairLocation }),
    });
    assert.equal(locationOrder.status, 201);
    assert.equal(createdData?.repairLocation, repairLocation);
  }

  const invalidLocation = await fetch(endpoint, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify({ ...body, repairLocation: "UNKNOWN" }),
  });
  assert.equal(invalidLocation.status, 400);

  const customerDenied = await fetch(endpoint, {
    method: "POST",
    headers: headers(customerToken),
    body: JSON.stringify(body),
  });
  assert.equal(customerDenied.status, 403);

  activeCustomer = false;
  const inactiveCustomer = await fetch(endpoint, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify(body),
  });
  assert.equal(inactiveCustomer.status, 404);
});
