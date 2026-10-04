import express from "express";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import {
  REPAIR_WARRANTY_DAYS,
  REPAIR_WARRANTY_TERMS,
} from "../src/features/orders/warranty-policy.js";
import { getRepairWarrantyExpiresAt } from "../src/features/orders/warranty-policy.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("pickup QR issues a fallback PIN and the PIN closes only its service order", async (t) => {
  const customerToken = "C".repeat(48);
  const staffToken = "T".repeat(48);
  const customerId = "11111111-1111-4111-8111-111111111111";
  const technician = {
    id: "22222222-2222-4222-8222-222222222222",
    email: "technician@example.test",
    displayName: "Мастер",
    phoneNumber: null,
    avatarObjectId: null,
    role: "TECHNICIAN" as const,
    active: true,
    mustChangePassword: false,
  };
  const customer = {
    id: customerId,
    email: "customer@example.test",
    displayName: "Клиент",
    phoneNumber: null,
    avatarObjectId: null,
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: false,
  };
  const serviceNumber = "SRV-2026-000082";
  const order = {
    id: "33333333-3333-4333-8333-333333333333",
    serviceNumber,
    customerId,
    assignedTechnicianId: technician.id,
    deviceType: "PHONE",
    problem: "Телефон не включается",
    status: "READY_FOR_PICKUP" as "READY_FOR_PICKUP" | "COMPLETED",
    customer: { displayName: "Клиент" },
  };
  const pickupCode: {
    id: string;
    orderId: string;
    tokenHash: string;
    fallbackCodeHash: string | null;
    fallbackCodeSalt: string | null;
    fallbackCodeAttempts: number;
    expiresAt: Date;
    usedAt: Date | null;
    order: typeof order;
  } = {
    id: "44444444-4444-4444-8444-444444444444",
    orderId: order.id,
    tokenHash: "0".repeat(64),
    fallbackCodeHash: null,
    fallbackCodeSalt: null,
    fallbackCodeAttempts: 0,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    usedAt: null,
    order,
  };
  const transaction = {
    $queryRaw: async () => [],
    repairOrderPickupCode: {
      findUnique: async () => pickupCode,
      update: async ({ data }: { data: Record<string, unknown> }) => {
        const attemptChange = data.fallbackCodeAttempts as
          { increment: number } | undefined;
        if (attemptChange)
          pickupCode.fallbackCodeAttempts += attemptChange.increment;
        if (data.usedAt instanceof Date) pickupCode.usedAt = data.usedAt;
        return pickupCode;
      },
    },
    repairOrder: {
      updateMany: async ({ data }: { data: { status: "COMPLETED" } }) => {
        Object.assign(order, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => order,
    },
    repairStatusEvent: { create: async ({ data }: { data: unknown }) => data },
    repairWarranty: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(issuedWarranty, data);
        return data;
      },
    },
    repairOrderItem: { findMany: async () => [] },
    technicianSalaryEntry: {
      create: async ({ data }: { data: unknown }) => data,
    },
  };
  const issuedWarranty: Record<string, unknown> = {};
  const usersByTokenHash = new Map([
    [hashSessionToken(customerToken), customer],
    [hashSessionToken(staffToken), technician],
  ]);
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = usersByTokenHash.get(where.tokenHash);
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    repairOrder: {
      findFirst: async ({ where }: { where: Record<string, string> }) =>
        where.id === order.id && where.customerId === customerId ? order : null,
      findUnique: async ({ where }: { where: { serviceNumber: string } }) =>
        where.serviceNumber === serviceNumber ? { id: order.id } : null,
    },
    repairOrderPickupCode: {
      upsert: async ({ update }: { update: Record<string, unknown> }) => {
        Object.assign(pickupCode, update);
        return pickupCode;
      },
    },
    user: { findMany: async () => [] },
    $transaction: async (
      callback: (client: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
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

  const issued = await fetch(`${baseUrl}/orders/${order.id}/pickup-code`, {
    method: "POST",
    headers: headers(customerToken),
  });
  assert.equal(issued.status, 201);
  const issuedCode = (await issued.json()) as {
    qrPayload: string;
    fallbackPin: string;
    expiresAt: string;
  };
  assert.match(issuedCode.fallbackPin, /^\d{4}$/u);
  assert.match(issuedCode.qrPayload, /^UTP-PICKUP:/u);
  assert.ok(pickupCode.fallbackCodeHash);
  assert.ok(pickupCode.fallbackCodeSalt);

  const closeUrl = `${baseUrl}/orders/close-by-qr`;
  const closeRequest = (pickupPin: string) =>
    fetch(closeUrl, {
      method: "POST",
      headers: headers(staffToken),
      body: JSON.stringify({
        serviceNumber,
        pickupPin,
      }),
    });
  const wrongPin = issuedCode.fallbackPin === "0000" ? "0001" : "0000";
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const rejected = await closeRequest(wrongPin);
    assert.equal(rejected.status, 404);
    assert.equal(pickupCode.fallbackCodeAttempts, attempt);
  }
  assert.equal(order.status, "READY_FOR_PICKUP");
  const blocked = await closeRequest(issuedCode.fallbackPin);
  assert.equal(blocked.status, 404);

  const renewed = await fetch(`${baseUrl}/orders/${order.id}/pickup-code`, {
    method: "POST",
    headers: headers(customerToken),
  });
  assert.equal(renewed.status, 201);
  const renewedCode = (await renewed.json()) as { fallbackPin: string };
  assert.equal(pickupCode.fallbackCodeAttempts, 0);

  const accepted = await closeRequest(renewedCode.fallbackPin);
  assert.equal(accepted.status, 200);
  assert.equal(order.status, "COMPLETED");
  assert.ok(pickupCode.usedAt instanceof Date);
  assert.equal(issuedWarranty.warrantyDays, REPAIR_WARRANTY_DAYS);
  assert.equal(issuedWarranty.terms, REPAIR_WARRANTY_TERMS);
  assert.equal(
    (issuedWarranty.expiresAt as Date).toISOString(),
    getRepairWarrantyExpiresAt(issuedWarranty.issuedAt as Date).toISOString(),
  );
});
