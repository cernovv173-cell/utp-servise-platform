import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCraftsRouter } from "../src/features/crafts/crafts.routes.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("customers cannot redeem bonuses for repair or product orders", async (t) => {
  const token = "C".repeat(48);
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "customer@example.test",
    displayName: "Customer",
    role: "CUSTOMER" as const,
    active: true,
    mustChangePassword: false,
  };
  let transactionCalls = 0;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(token)
          ? { expiresAt: new Date(Date.now() + 60_000), user }
          : null,
    },
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error("A customer request must not enter a transaction.");
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
  app.use("/api", createCraftsRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const headers = {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };

  const repairResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/22222222-2222-4222-8222-222222222222/bonus-redemption`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ redeemBonuses: true }),
    },
  );
  const craftResponse = await fetch(
    `http://127.0.0.1:${address.port}/api/craft-orders/33333333-3333-4333-8333-333333333333/bonus-redemption`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify({ redeemBonuses: true }),
    },
  );

  assert.equal(repairResponse.status, 403);
  assert.equal(craftResponse.status, 403);
  assert.equal(transactionCalls, 0);
});

test("admins can redeem only at the service center while technicians can redeem onsite", async (t) => {
  const adminToken = "A".repeat(48);
  const technicianToken = "T".repeat(48);
  const customerId = "11111111-1111-4111-8111-111111111111";
  const technicianId = "44444444-4444-4444-8444-444444444444";
  const admin = {
    id: "55555555-5555-4555-8555-555555555555",
    email: "admin@example.test",
    displayName: "Администратор",
    role: "ADMIN" as const,
    active: true,
    mustChangePassword: false,
  };
  const technician = {
    id: technicianId,
    email: "technician@example.test",
    displayName: "Мастер",
    role: "TECHNICIAN" as const,
    active: true,
    mustChangePassword: false,
  };
  const makeOrder = (id: string, repairLocation: string) => ({
    id,
    customerId,
    assignedTechnicianId: technicianId,
    serviceNumber: `SRV-${id}`,
    status: "COMPLETED",
    repairLocation,
    visitScenarioVersion: 1,
    redeemBonuses: false,
    bonusDiscountRub: 0,
    items: [{ type: "SERVICE", quantity: 1, unitPriceRub: 1_000 }],
    receipt: {
      id: `receipt-${id}`,
      receiptNumber: `DOC-${id}`,
      paymentStatus: "PENDING" as "PENDING" | "PAID",
      totalRub: 1_000,
      itemsSnapshot: [],
      bonusDiscountRub: 0,
    },
  });
  const workshopOrder = makeOrder(
    "22222222-2222-4222-8222-222222222222",
    "SERVICE_CENTER",
  );
  const onsiteOrder = makeOrder(
    "33333333-3333-4333-8333-333333333333",
    "CUSTOMER_ADDRESS",
  );
  const orders = new Map([
    [workshopOrder.id, workshopOrder],
    [onsiteOrder.id, onsiteOrder],
  ]);
  const receiptById = new Map(
    [workshopOrder, onsiteOrder].map((order) => [
      order.receipt.id,
      order.receipt,
    ]),
  );
  const loyaltyEntries: Array<Record<string, unknown>> = [];
  const transaction = {
    $queryRaw: async () => [],
    repairOrder: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        orders.get(where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const order = orders.get(where.id);
        assert.ok(order);
        Object.assign(order, data);
        return order;
      },
    },
    repairReceipt: {
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const receipt = receiptById.get(where.id);
        assert.ok(receipt);
        return receipt;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const receipt = receiptById.get(where.id);
        assert.ok(receipt);
        Object.assign(receipt, data);
        return receipt;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; paymentStatus: "PENDING" };
        data: Record<string, unknown>;
      }) => {
        const receipt = receiptById.get(where.id);
        if (!receipt || receipt.paymentStatus !== where.paymentStatus) {
          return { count: 0 };
        }
        Object.assign(receipt, data);
        return { count: 1 };
      },
    },
    loyaltyTransaction: {
      aggregate: async () => ({ _sum: { points: 1_000 } }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        loyaltyEntries.push(data);
        return data;
      },
    },
    customerReferral: { findUnique: async () => null },
  };
  const usersByTokenHash = new Map([
    [hashSessionToken(adminToken), admin],
    [hashSessionToken(technicianToken), technician],
  ]);
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = usersByTokenHash.get(where.tokenHash);
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    repairOrder: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        orders.get(where.id) ?? null,
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
  const request = (
    token: string,
    orderId: string,
    path: string,
    body: unknown,
  ) =>
    fetch(`http://127.0.0.1:${address.port}/api/orders/${orderId}/${path}`, {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

  const adminWorkshopRedemption = await request(
    adminToken,
    workshopOrder.id,
    "bonus-redemption",
    { redeemBonuses: true },
  );
  assert.equal(adminWorkshopRedemption.status, 200);
  assert.equal(workshopOrder.bonusDiscountRub, 300);

  const adminWorkshopPayment = await request(
    adminToken,
    workshopOrder.id,
    "receipt/payment",
    { paymentMethod: "CASH" },
  );
  assert.equal(adminWorkshopPayment.status, 200);
  assert.equal(workshopOrder.receipt.paymentStatus, "PAID");
  assert.deepEqual(
    loyaltyEntries.map(({ type, points }) => [type, points]),
    [
      ["REDEEM", -300],
      ["EARN", 70],
    ],
  );

  const adminOnsiteRedemption = await request(
    adminToken,
    onsiteOrder.id,
    "bonus-redemption",
    { redeemBonuses: true },
  );
  const adminOnsitePayment = await request(
    adminToken,
    onsiteOrder.id,
    "receipt/payment",
    { paymentMethod: "CASH" },
  );
  assert.equal(adminOnsiteRedemption.status, 403);
  assert.equal(adminOnsitePayment.status, 403);
  assert.equal(onsiteOrder.redeemBonuses, false);
  assert.equal(onsiteOrder.receipt.paymentStatus, "PENDING");

  const technicianOnsiteRedemption = await request(
    technicianToken,
    onsiteOrder.id,
    "bonus-redemption",
    { redeemBonuses: true },
  );
  assert.equal(technicianOnsiteRedemption.status, 200);
  assert.equal(onsiteOrder.bonusDiscountRub, 300);
});
