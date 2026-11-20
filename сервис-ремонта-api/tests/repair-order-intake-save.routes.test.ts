import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("assigned technician can create and update the service intake act without attachments", async (t) => {
  const sessionToken = "T".repeat(48);
  const adminToken = "A".repeat(48);
  const technicianId = "22222222-2222-4222-8222-222222222222";
  const orderId = "33333333-3333-4333-8333-333333333333";
  const order = {
    id: orderId,
    customerId: "11111111-1111-4111-8111-111111111111",
    assignedTechnicianId: technicianId,
    status: "ASSIGNED",
  };
  const state: { intake: Record<string, unknown> | null } = { intake: null };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const token = [sessionToken, adminToken].find(
          (candidate) => hashSessionToken(candidate) === where.tokenHash,
        );
        if (!token) return null;
        const isAdmin = token === adminToken;
        return {
          expiresAt: new Date(Date.now() + 60_000),
          user: {
            id: isAdmin ? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : technicianId,
            email: isAdmin ? "admin@example.test" : "technician@example.test",
            displayName: isAdmin ? "Администратор" : "Мастер",
            phoneNumber: null,
            avatarObjectId: null,
            role: isAdmin ? ("ADMIN" as const) : ("TECHNICIAN" as const),
            active: true,
            terminatedAt: null,
            mustChangePassword: false,
          },
        };
      },
    },
    repairOrder: {
      findUnique: async () => order,
    },
    repairOrderIntake: {
      upsert: async ({
        create,
        update,
      }: {
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        state.intake = state.intake
          ? { ...state.intake, ...update }
          : { ...create };
        return state.intake;
      },
    },
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

  const endpoint = `http://127.0.0.1:${address.port}/api/orders/${orderId}/intake`;
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      conditionSummary: "Корпус целый, устройство не включается.",
      serialNumber: "SN-123",
      includedAccessories: "Блок питания",
      intakeNotes: "Принято в сервисном центре",
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(
    state.intake?.conditionSummary,
    "Корпус целый, устройство не включается.",
  );
  assert.equal(state.intake?.serialNumber, "SN-123");
  assert.equal(state.intake?.createdById, technicianId);
  assert.equal(state.intake?.updatedById, technicianId);
  assert.equal("intakeMediaObjectId" in (state.intake ?? {}), false);

  const edited = await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      conditionSummary: "Корпус целый, экран с царапиной.",
      serialNumber: "SN-123",
      includedAccessories: "Блок питания",
      intakeNotes: "Повторный осмотр",
    }),
  });

  assert.equal(edited.status, 200);
  assert.equal(
    state.intake?.conditionSummary,
    "Корпус целый, экран с царапиной.",
  );

  const administratorEdit = await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${adminToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      conditionSummary: "Попытка изменения после назначения мастера",
    }),
  });
  assert.equal(administratorEdit.status, 403);
  assert.equal(
    state.intake?.conditionSummary,
    "Корпус целый, экран с царапиной.",
  );
});

test("an active home-visit order cannot be marked ready for service-center pickup", async (t) => {
  const sessionToken = "T".repeat(48);
  const technicianId = "22222222-2222-4222-8222-222222222222";
  const orderId = "55555555-5555-4555-8555-555555555555";
  const order = {
    id: orderId,
    customerId: "11111111-1111-4111-8111-111111111111",
    assignedTechnicianId: technicianId,
    status: "IN_PROGRESS",
    visitScenarioVersion: 1,
    repairLocation: "CUSTOMER_ADDRESS",
    visitPickupAgreedAt: null,
  };
  const transaction = {
    $queryRaw: async () => [],
    repairOrder: { findUnique: async () => order },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? {
              expiresAt: new Date(Date.now() + 60_000),
              user: {
                id: technicianId,
                email: "technician@example.test",
                displayName: "Мастер",
                phoneNumber: null,
                avatarObjectId: null,
                role: "TECHNICIAN" as const,
                active: true,
                terminatedAt: null,
                mustChangePassword: false,
              },
            }
          : null,
    },
    $transaction: async <T>(
      callback: (client: typeof transaction) => Promise<T>,
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

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/orders/${orderId}/status`,
    {
      method: "PATCH",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ status: "READY_FOR_PICKUP" }),
    },
  );

  assert.equal(response.status, 409);
  assert.match(await response.text(), /передаёт технику в сервисный центр/u);
});
