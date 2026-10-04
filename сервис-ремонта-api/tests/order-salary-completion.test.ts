import express from "express";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("pickup QR closes a ready order once and issues warranty and technician salary", async (t) => {
  const sessionToken = "T".repeat(48);
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
  const serviceNumber = "SRV-2026-000081";
  const rawToken = "P".repeat(43);
  const qrPayload = `UTP-PICKUP:${rawToken}`;
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const issuedAt = new Date();
  const currentOrder = {
    id: "33333333-3333-4333-8333-333333333333",
    serviceNumber,
    customerId,
    assignedTechnicianId: technician.id,
    deviceType: "PHONE",
    problem: "Телефон не включается",
    status: "READY_FOR_PICKUP" as const,
    customer: { displayName: "Клиент" },
  };
  const code = {
    id: "44444444-4444-4444-8444-444444444444",
    orderId: currentOrder.id,
    tokenHash,
    expiresAt: new Date(issuedAt.getTime() + 60 * 60 * 1000),
    usedAt: null as Date | null,
    order: currentOrder,
  };
  let recordedSalary: Record<string, unknown> | undefined;
  let recordedWarranty: Record<string, unknown> | undefined;
  let recordedEvent: Record<string, unknown> | undefined;
  const transaction = {
    $queryRaw: async () => [],
    repairOrderPickupCode: {
      findUnique: async () => code,
      update: async ({ data }: { data: { usedAt: Date } }) => {
        code.usedAt = data.usedAt;
        return code;
      },
    },
    repairOrder: {
      updateMany: async ({
        data,
      }: {
        data: { status: "COMPLETED"; bonusDiscountRub: number };
      }) => {
        Object.assign(currentOrder, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => currentOrder,
    },
    repairStatusEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedEvent = data;
        return { ...data, createdAt: issuedAt };
      },
    },
    repairWarranty: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedWarranty = data;
        return { id: "55555555-5555-4555-8555-555555555555", ...data };
      },
    },
    repairOrderItem: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        assert.deepEqual(where, { orderId: currentOrder.id, type: "SERVICE" });
        return [
          { quantity: 2, unitPriceRub: 500 },
          { quantity: 1, unitPriceRub: 200 },
        ];
      },
    },
    technicianSalaryEntry: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedSalary = data;
        return data;
      },
    },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user: technician }
          : null,
    },
    repairOrderPickupCode: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === tokenHash ? { orderId: currentOrder.id } : null,
    },
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
  const endpoint = `http://127.0.0.1:${address.port}/api/orders/close-by-qr`;
  const headers = {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      qrPayload,
      warrantyDays: 90,
      warrantyTerms:
        "Старые приложения могут отправлять эти поля; сервер использует единый срок.",
    }),
  });
  assert.equal(response.status, 200);
  assert.equal(currentOrder.status, "COMPLETED");
  assert.ok(code.usedAt instanceof Date);
  assert.equal(recordedEvent?.actorId, technician.id);
  assert.equal(recordedEvent?.from, "READY_FOR_PICKUP");
  assert.equal(recordedEvent?.to, "COMPLETED");
  assert.equal(recordedWarranty?.warrantyNumber, `WTY-${serviceNumber}`);
  assert.equal(recordedWarranty?.warrantyDays, 365);
  assert.match(
    String(recordedWarranty?.terms),
    /Гарантия на ремонт компьютеров/u,
  );
  assert.match(String(recordedWarranty?.terms), /статья 29/u);
  assert.ok(String(recordedWarranty?.terms).length > 2000);
  assert.equal(recordedWarranty?.issuedById, technician.id);
  assert.equal(recordedSalary?.technicianId, technician.id);
  assert.equal(recordedSalary?.serviceTotalRub, 1_200);
  assert.equal(recordedSalary?.salaryRub, 900);
  assert.equal(recordedSalary?.ratePercent, 75);
  assert.equal(
    (recordedSalary?.earnedAt as Date).toISOString(),
    (recordedWarranty?.issuedAt as Date).toISOString(),
  );

  const replay = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      qrPayload,
    }),
  });
  assert.equal(replay.status, 404);
});
