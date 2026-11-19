import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createRepairVisitRouter } from "../src/features/orders/repair-visits.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const orderId = "11111111-1111-4111-8111-111111111111";
const technicianToken = "T".repeat(48);
const technicianId = "technician-id";

const startVisitApp = async (assignedTechnicianId = technicianId) => {
  let intakeLookups = 0;
  let orderUpdates = 0;
  const statusEvents: Array<{ note: string }> = [];
  const currentOrder = {
    id: orderId,
    customerId: "customer-id",
    assignedTechnicianId,
    status: "ASSIGNED",
    repairLocation: "CUSTOMER_ADDRESS",
    visitScenarioVersion: 1,
    visitPickupAgreedAt: null as Date | null,
  };
  const transaction = {
    $queryRaw: async () => [],
    repairOrder: {
      findUnique: async () => currentOrder,
      update: async ({ data }: { data: Partial<typeof currentOrder> }) => {
        orderUpdates += 1;
        Object.assign(currentOrder, data);
        return currentOrder;
      },
    },
    repairOrderIntake: {
      findUnique: async () => {
        intakeLookups += 1;
        return null;
      },
    },
    repairStatusEvent: {
      create: async ({ data }: { data: { note: string } }) => {
        statusEvents.push(data);
        return data;
      },
    },
  };
  const database = {
    $transaction: async <T>(
      callback: (client: typeof transaction) => Promise<T>,
    ) => callback(transaction),
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        if (where.tokenHash !== hashSessionToken(technicianToken)) return null;
        return {
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: technicianId,
            role: "TECHNICIAN" as const,
            email: null,
            login: null,
            displayName: "Мастер",
            phoneNumber: null,
            gender: null,
            birthDate: null,
            telegramChatId: null,
            maxUserId: null,
            avatarObjectId: null,
            active: true,
            terminatedAt: null,
            mustChangePassword: false,
          },
        };
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createRepairVisitRouter(database as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  return {
    baseUrl: `http://127.0.0.1:${address.port}/api`,
    close: () => server.close(),
    get intakeLookups() {
      return intakeLookups;
    },
    get orderUpdates() {
      return orderUpdates;
    },
    statusEvents,
  };
};

test("assigned technician can transfer a home-visit order without an intake act", async (t) => {
  const visit = await startVisitApp();
  t.after(() => visit.close());

  const response = await fetch(
    `${visit.baseUrl}/orders/${orderId}/visit-pickup`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${technicianToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerConsent: true }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(visit.intakeLookups, 0);
  assert.equal(visit.orderUpdates, 1);
  assert.equal(
    visit.statusEvents[0]?.note,
    "Мастер подтвердил согласие клиента на перевозку техники в сервис",
  );
  const body = (await response.json()) as { order: { repairLocation: string } };
  assert.equal(body.order.repairLocation, "SERVICE_CENTER");
});

test("another technician cannot transfer an unassigned home-visit order", async (t) => {
  const visit = await startVisitApp("someone-else");
  t.after(() => visit.close());

  const response = await fetch(
    `${visit.baseUrl}/orders/${orderId}/visit-pickup`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${technicianToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ customerConsent: true }),
    },
  );

  assert.equal(response.status, 404);
  assert.equal(visit.orderUpdates, 0);
  assert.equal(visit.intakeLookups, 0);
});
