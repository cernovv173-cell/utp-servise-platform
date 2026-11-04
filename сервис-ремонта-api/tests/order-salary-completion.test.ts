import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createRepairOrderReleaseRouter } from "../src/features/orders/repair-order-release.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("standard order release verifies payment and issues receipt, warranty, and salary", async (t) => {
  const sessionToken = "T".repeat(48);
  const technicianId = "22222222-2222-4222-8222-222222222222";
  const customerId = "11111111-1111-4111-8111-111111111111";
  const orderId = "33333333-3333-4333-8333-333333333333";
  const technician = {
    id: technicianId,
    email: "technician@example.test",
    displayName: "Мастер",
    phoneNumber: null,
    avatarObjectId: null,
    role: "TECHNICIAN" as const,
    salaryRatePercent: 60,
    active: true,
    mustChangePassword: false,
  };
  const items = [
    {
      id: "line-1",
      type: "SERVICE",
      name: "Ремонт",
      quantity: 2,
      unitPriceRub: 500,
    },
    {
      id: "line-2",
      type: "SERVICE",
      name: "Диагностика",
      quantity: 1,
      unitPriceRub: 200,
    },
  ];
  const order: {
    id: string;
    serviceNumber: string;
    customerId: string;
    assignedTechnicianId: string;
    deviceType: string;
    problem: string;
    status: string;
    customer: { displayName: string; phoneNumber: string };
    contactPhone: string | null;
    redeemBonuses: boolean;
    items: typeof items;
    receipt: Record<string, unknown> | null;
    salaryEntry: Record<string, unknown> | null;
    bonusDiscountRub?: number;
  } = {
    id: orderId,
    serviceNumber: "SRV-2026-000081",
    customerId,
    assignedTechnicianId: technicianId,
    deviceType: "PHONE",
    problem: "Телефон не включается",
    status: "READY_FOR_PICKUP",
    customer: { displayName: "Клиент", phoneNumber: "+79990000000" },
    contactPhone: null,
    redeemBonuses: false,
    items,
    receipt: null,
    salaryEntry: null,
  };
  const intake = {
    conditionSummary: "Корпус без повреждений, телефон не включается.",
    intakeMediaObjectId: "intake-media-1",
  };
  const loyaltyEntries: Array<Record<string, unknown>> = [];
  let recordedEvent: Record<string, unknown> | undefined;
  let recordedWarranty: Record<string, unknown> | undefined;
  let recordedSalary: Record<string, unknown> | undefined;

  const transaction = {
    $queryRaw: async () => [],
    repairOrder: {
      findUnique: async () => order,
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(order, data);
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({
        ...order,
        items,
        receipt: order.receipt,
        warranty: recordedWarranty,
      }),
    },
    repairOrderIntake: { findUnique: async () => intake },
    loyaltyTransaction: {
      aggregate: async () => ({ _sum: { points: 0 } }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        loyaltyEntries.push(data);
        return data;
      },
    },
    repairReceipt: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        order.receipt = { id: "receipt-1", ...data };
        return order.receipt;
      },
      update: async ({ data }: { data: Record<string, unknown> }) => {
        order.receipt = { ...order.receipt, ...data };
        return order.receipt;
      },
    },
    repairStatusEvent: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedEvent = data;
        return { ...data, createdAt: new Date() };
      },
    },
    repairWarranty: {
      findUnique: async () => null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedWarranty = { id: "warranty-1", ...data };
        return recordedWarranty;
      },
    },
    user: {
      findUnique: async () => ({
        salaryRatePercent: technician.salaryRatePercent,
      }),
    },
    technicianSalaryEntry: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        recordedSalary = data;
        return data;
      },
    },
    customerReferral: { findUnique: async () => null },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? { expiresAt: new Date(Date.now() + 60_000), user: technician }
          : null,
    },
    repairOrder: { findUnique: async () => order },
    repairOrderIntake: { findUnique: async () => intake },
    loyaltyTransaction: { aggregate: async () => ({ _sum: { points: 0 } }) },
    user: { findMany: async () => [] },
    pushDeviceToken: { findMany: async () => [] },
    $transaction: async (
      callback: (client: typeof transaction) => Promise<unknown>,
    ) => callback(transaction),
  };

  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.log = { error: () => undefined } as typeof request.log;
    next();
  });
  app.use(
    "/api",
    createRepairOrderReleaseRouter(database as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders/${orderId}`;
  const headers = {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  };

  const summaryResponse = await fetch(`${endpoint}/release-summary`, {
    headers,
  });
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json()) as {
    totalRub: number;
    amountDueRub: number;
    paymentMethods: string[];
  };
  assert.equal(summary.totalRub, 1200);
  assert.equal(summary.amountDueRub, 1200);
  assert.ok(summary.paymentMethods.includes("CARD_TERMINAL"));

  const wrongAmount = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedAmountRub: 1100,
      paymentMethod: "CARD_TERMINAL",
    }),
  });
  assert.equal(wrongAmount.status, 409);
  assert.equal(order.status, "READY_FOR_PICKUP");

  const missingPaymentMethod = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedAmountRub: 1200 }),
  });
  assert.equal(missingPaymentMethod.status, 400);
  assert.equal(order.status, "READY_FOR_PICKUP");

  const released = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedAmountRub: 1200,
      paymentMethod: "CARD_TERMINAL",
    }),
  });
  assert.equal(released.status, 200);
  assert.equal(order.status, "COMPLETED");
  assert.equal(order.receipt?.paymentStatus, "PAID");
  assert.equal(order.receipt?.paymentMethod, "CARD_TERMINAL");
  assert.equal(order.receipt?.totalRub, 1200);
  assert.equal(recordedEvent?.actorId, technicianId);
  assert.equal(recordedEvent?.from, "READY_FOR_PICKUP");
  assert.equal(recordedEvent?.to, "COMPLETED");
  assert.equal(recordedWarranty?.warrantyNumber, `WTY-${order.serviceNumber}`);
  assert.equal(recordedWarranty?.warrantyDays, 365);
  assert.equal(recordedSalary?.technicianId, technicianId);
  assert.equal(recordedSalary?.serviceTotalRub, 1200);
  assert.equal(recordedSalary?.salaryRub, 720);
  assert.equal(recordedSalary?.ratePercent, 60);
  assert.equal(loyaltyEntries.length, 1);
  assert.equal(loyaltyEntries[0]?.type, "EARN");

  const replay = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedAmountRub: 1200,
      paymentMethod: "CARD_TERMINAL",
    }),
  });
  assert.equal(replay.status, 409);
});
