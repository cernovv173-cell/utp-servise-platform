import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("warranty claims require the customer's active completed warranty and get a separate chat", async (t) => {
  const customerId = "11111111-1111-4111-8111-111111111111";
  const sourceOrderId = "22222222-2222-4222-8222-222222222222";
  const claimOrderId = "33333333-3333-4333-8333-333333333333";
  const token = "C".repeat(48);
  const customer = {
    id: customerId,
    email: "customer@example.test",
    displayName: "Клиент",
    phoneNumber: "+79990000000",
    avatarObjectId: null,
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: false,
  };
  const source = {
    id: sourceOrderId,
    customerId,
    serviceNumber: "SRV-2026-000001",
    status: "COMPLETED",
    customerDeviceId: "44444444-4444-4444-8444-444444444444",
    deviceType: "LAPTOP",
    deviceBrand: "Lenovo",
    deviceModel: "ThinkPad",
    deviceSerialNumber: "SERIAL-1",
    problem: "Не включался",
    address: "Казань, Ленина, 1",
    contactPhone: "+79990000000",
    city: "Казань",
    street: "Ленина",
    house: "1",
    apartment: null,
    entrance: null,
    hasBarrier: false,
    floor: null,
    additionalPhone: null,
    additionalInfo: null,
    warranty: {
      warrantyNumber: "WTY-SRV-2026-000001",
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  };
  let currentSource: typeof source | null = source;
  let createdData: Record<string, unknown> | null = null;
  let chatCreated = false;
  let initialMessage: Record<string, unknown> | null = null;
  const transaction = {
    repairOrder: {
      findFirst: async ({
        where,
      }: {
        where: { id: string; customerId: string };
      }) =>
        where.id === sourceOrderId && where.customerId === customerId
          ? currentSource
          : null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        createdData = data;
        return {
          id: claimOrderId,
          serviceNumber: data.serviceNumber,
          customerId,
          assignedTechnicianId: null,
        };
      },
      findUniqueOrThrow: async () => ({
        id: claimOrderId,
        serviceNumber: "SRV-2026-000007",
        customerId,
        assignedTechnicianId: null,
        warrantyOriginOrder: {
          id: sourceOrderId,
          serviceNumber: source.serviceNumber,
        },
      }),
    },
    $queryRaw: async () => [{ value: 7n }],
    repairStatusEvent: { create: async () => undefined },
    orderChat: {
      create: async ({
        data,
      }: {
        data: {
          orderId: string;
          adminRequestedAt: Date;
          adminRequestedById: string;
        };
      }) => {
        assert.equal(data.orderId, claimOrderId);
        assert.equal(data.adminRequestedById, customerId);
        assert.ok(data.adminRequestedAt instanceof Date);
        chatCreated = true;
        return { id: "66666666-6666-4666-8666-666666666666" };
      },
    },
    orderChatMessage: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        initialMessage = data;
      },
    },
  };
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user: customer }
          : null,
    },
    $transaction: async <T>(
      operation: (db: typeof transaction) => Promise<T>,
    ) => operation(transaction),
    user: { findMany: async () => [] },
  };
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.log = { error: () => undefined } as typeof request.log;
    next();
  });
  app.use("/api", createOrdersRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders/${sourceOrderId}/warranty-claims`;
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  const created = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ problem: "Снова выключается при работе" }),
  });
  assert.equal(created.status, 201);
  assert.equal(chatCreated, true);
  assert.equal(initialMessage?.senderId, customerId);
  assert.equal(initialMessage?.content, "Снова выключается при работе");
  assert.equal(createdData?.warrantyOriginOrderId, sourceOrderId);
  assert.equal(createdData?.customerDeviceId, source.customerDeviceId);
  assert.equal(createdData?.address, source.address);
  assert.equal(createdData?.problem, "Снова выключается при работе");
  assert.deepEqual((await created.json()).order.warrantyOriginOrder, {
    id: sourceOrderId,
    serviceNumber: source.serviceNumber,
  });

  currentSource = {
    ...source,
    warranty: { ...source.warranty, expiresAt: new Date(Date.now() - 1) },
  };
  const expired = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({ problem: "Снова выключается при работе" }),
  });
  assert.equal(expired.status, 409);
  assert.equal((await expired.json()).error.code, "WARRANTY_NOT_ACTIVE");

  const foreignOrder = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/55555555-5555-4555-8555-555555555555/warranty-claims`,
    {
      method: "POST",
      headers,
      body: JSON.stringify({ problem: "Попытка открыть чужую гарантию" }),
    },
  );
  assert.equal(foreignOrder.status, 404);
});
