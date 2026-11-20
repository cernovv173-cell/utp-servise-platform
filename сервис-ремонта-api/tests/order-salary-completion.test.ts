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
  const adminSessionToken = "A".repeat(48);
  const administratorId = "44444444-4444-4444-8444-444444444444";
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
  const administrator = {
    ...technician,
    id: administratorId,
    email: "admin@example.test",
    displayName: "Администратор",
    role: "ADMIN" as const,
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
    {
      id: "line-3",
      type: "SPARE_PART",
      name: "Запчасть",
      quantity: 1,
      unitPriceRub: 800,
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
    workActRequired: boolean;
    workAct: { status: string };
    customer: { displayName: string; phoneNumber: string };
    contactPhone: string | null;
    redeemBonuses: boolean;
    diagnosisFeeRub: number;
    visitFeeRub: number;
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
    workActRequired: true,
    workAct: { status: "APPROVED" },
    customer: { displayName: "Клиент", phoneNumber: "+79990000000" },
    contactPhone: null,
    redeemBonuses: false,
    diagnosisFeeRub: 0,
    visitFeeRub: 0,
    items,
    receipt: null,
    salaryEntry: null,
  };
  const intake = {
    conditionSummary: "Корпус без повреждений, телефон не включается.",
    intakeMediaObjectId: null,
  };
  const loyaltyEntries: Array<Record<string, unknown>> = [];
  const customerBalance = 1_000;
  let recordedEvent: Record<string, unknown> | undefined;
  let recordedWarranty: Record<string, unknown> | undefined;
  let recordedSalary: Record<string, unknown> | undefined;
  const followUps: Array<Record<string, unknown>> = [];

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
    repairOrderFollowUp: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        followUps.push(data);
        return { id: "follow-up-1", ...data };
      },
    },
    loyaltyTransaction: {
      aggregate: async () => ({ _sum: { points: customerBalance } }),
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
          : where.tokenHash === hashSessionToken(adminSessionToken)
            ? { expiresAt: new Date(Date.now() + 60_000), user: administrator }
            : null,
    },
    repairOrder: { findUnique: async () => order },
    repairOrderIntake: { findUnique: async () => intake },
    loyaltyTransaction: {
      aggregate: async () => ({ _sum: { points: customerBalance } }),
    },
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
  const technicianHeaders = {
    authorization: `Bearer ${sessionToken}`,
    "content-type": "application/json",
  };
  const headers = {
    authorization: `Bearer ${adminSessionToken}`,
    "content-type": "application/json",
  };

  const technicianSummary = await fetch(`${endpoint}/release-summary`, {
    headers: technicianHeaders,
  });
  assert.equal(technicianSummary.status, 403);

  const summaryResponse = await fetch(`${endpoint}/release-summary`, {
    headers,
  });
  assert.equal(summaryResponse.status, 200);
  const summary = (await summaryResponse.json()) as {
    totalRub: number;
    bonusDiscountRub: number;
    maxBonusDiscountRub: number;
    redeemBonuses: boolean;
    amountDueRub: number;
    paymentMethods: string[];
  };
  assert.equal(summary.totalRub, 2000);
  assert.equal(summary.bonusDiscountRub, 0);
  assert.equal(summary.maxBonusDiscountRub, 360);
  assert.equal(summary.redeemBonuses, false);
  assert.equal(summary.amountDueRub, 2000);
  assert.ok(summary.paymentMethods.includes("CARD_TERMINAL"));

  const wrongAmount = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedAmountRub: 1639,
      paymentMethod: "CARD_TERMINAL",
      redeemBonuses: true,
    }),
  });
  assert.equal(wrongAmount.status, 409);
  assert.equal(order.status, "READY_FOR_PICKUP");

  const missingPaymentMethod = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({ expectedAmountRub: 1640, redeemBonuses: true }),
  });
  assert.equal(missingPaymentMethod.status, 400);
  assert.equal(order.status, "READY_FOR_PICKUP");

  const released = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedAmountRub: 1640,
      paymentMethod: "CARD_TERMINAL",
      redeemBonuses: true,
    }),
  });
  assert.equal(released.status, 200);
  assert.equal(order.status, "COMPLETED");
  assert.equal(order.receipt?.paymentStatus, "PAID");
  assert.equal(order.receipt?.paymentMethod, "CARD_TERMINAL");
  assert.equal(order.receipt?.totalRub, 2000);
  assert.equal(order.receipt?.bonusDiscountRub, 360);
  assert.equal(order.redeemBonuses, true);
  assert.equal(recordedEvent?.actorId, administratorId);
  assert.equal(recordedEvent?.from, "READY_FOR_PICKUP");
  assert.equal(recordedEvent?.to, "COMPLETED");
  assert.equal(recordedWarranty?.warrantyNumber, `WTY-${order.serviceNumber}`);
  assert.equal(recordedWarranty?.warrantyDays, 365);
  assert.equal(recordedSalary?.technicianId, technicianId);
  assert.equal(recordedSalary?.serviceTotalRub, 1200);
  assert.equal(recordedSalary?.salaryRub, 720);
  assert.equal(recordedSalary?.ratePercent, 60);
  assert.equal(followUps.length, 1);
  assert.equal(followUps[0]?.orderId, orderId);
  assert.ok(followUps[0]?.scheduledAt instanceof Date);
  assert.equal(followUps[0]?.scheduledAt, followUps[0]?.nextAttemptAt);
  assert.equal(loyaltyEntries.length, 2);
  assert.deepEqual(
    loyaltyEntries.map(({ type, points }) => ({ type, points })),
    [
      { type: "REDEEM", points: -360 },
      { type: "EARN", points: 164 },
    ],
  );

  const replay = await fetch(`${endpoint}/release`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      expectedAmountRub: 1640,
      paymentMethod: "CARD_TERMINAL",
    }),
  });
  assert.equal(replay.status, 409);
});
