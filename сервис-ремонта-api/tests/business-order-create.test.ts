import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createOrdersRouter } from "../src/features/orders/orders.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("company orders require the owner's profile and a device from the same scope", async (t) => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const profileId = "33333333-3333-4333-8333-333333333333";
  const companyDeviceId = "44444444-4444-4444-8444-444444444444";
  const personalDeviceId = "55555555-5555-4555-8555-555555555555";
  const orderId = "66666666-6666-4666-8666-666666666666";
  const tokens = new Map([
    ["O".repeat(48), { id: ownerId, profileId }],
    ["C".repeat(48), { id: otherId, profileId: null }],
  ]);
  const companyDevice = {
    id: companyDeviceId,
    customerId: ownerId,
    businessProfileId: profileId,
    deviceType: "LAPTOP",
    brand: "Lenovo",
    model: "ThinkPad",
    serialNumber: "SERIAL-1",
  };
  const personalDevice = {
    id: personalDeviceId,
    customerId: ownerId,
    businessProfileId: null,
    deviceType: "LAPTOP",
    brand: "Dell",
    model: "Latitude",
    serialNumber: null,
  };
  const deviceFinds: Record<string, unknown>[] = [];
  const orderCreates: Record<string, unknown>[] = [];
  const transaction = {
    appSetting: { findUnique: async () => null },
    customerBusinessProfile: {
      findUnique: async ({ where }: { where: { ownerUserId: string } }) => {
        const session = [...tokens.values()].find(
          ({ id }) => id === where.ownerUserId,
        );
        return session?.profileId ? { id: session.profileId } : null;
      },
    },
    customerDevice: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        deviceFinds.push(where);
        return (
          [companyDevice, personalDevice].find(
            (device) =>
              device.id === where.id &&
              device.customerId === where.customerId &&
              device.businessProfileId === where.businessProfileId,
          ) ?? null
        );
      },
    },
    $queryRaw: async () => [{ value: 7n }],
    repairOrder: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        orderCreates.push(data);
        return {
          id: orderId,
          serviceNumber: data.serviceNumber,
          customerId: data.customerId,
          assignedTechnicianId: null,
        };
      },
      findUniqueOrThrow: async () => ({
        id: orderId,
        serviceNumber: "SRV-2026-000007",
        businessProfileId: profileId,
        businessProfile: { id: profileId, companyName: "ООО Альфа" },
      }),
    },
    repairStatusEvent: { create: async () => undefined },
  };
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const session = [...tokens.entries()].find(
          ([token]) => hashSessionToken(token) === where.tokenHash,
        )?.[1];
        return session
          ? {
              expiresAt: new Date(Date.now() + 60_000),
              user: {
                id: session.id,
                email: null,
                login: null,
                displayName: "Клиент",
                phoneNumber: "+79990000000",
                gender: null,
                birthDate: null,
                telegramChatId: null,
                maxUserId: null,
                avatarObjectId: null,
                role: "CUSTOMER" as const,
                active: true,
                mustChangePassword: false,
              },
            }
          : null;
      },
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
  app.use("/api", createOrdersRouter(database as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/orders`;
  const send = (token: string, body: Record<string, unknown>) =>
    fetch(endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        deviceType: "LAPTOP",
        problem: "Не включается рабочий ноутбук",
        contactPhone: "+79990000000",
        ...body,
      }),
    });

  const businessOrder = await send("O".repeat(48), {
    businessOrder: true,
    customerDeviceId: companyDeviceId,
  });
  assert.equal(businessOrder.status, 201);
  assert.equal(orderCreates[0]?.businessProfileId, profileId);
  assert.equal(deviceFinds[0]?.businessProfileId, profileId);
  assert.equal(
    (await businessOrder.json()).order.businessProfile.companyName,
    "ООО Альфа",
  );

  const personalOrderUsingCompanyDevice = await send("O".repeat(48), {
    customerDeviceId: companyDeviceId,
  });
  assert.equal(personalOrderUsingCompanyDevice.status, 404);
  assert.equal(orderCreates.length, 1);
  assert.equal(deviceFinds[1]?.businessProfileId, null);

  const businessOrderUsingPersonalDevice = await send("O".repeat(48), {
    businessOrder: true,
    customerDeviceId: personalDeviceId,
  });
  assert.equal(businessOrderUsingPersonalDevice.status, 404);
  assert.equal(orderCreates.length, 1);

  const foreignCompanyOrder = await send("C".repeat(48), {
    businessOrder: true,
    customerDeviceId: companyDeviceId,
  });
  assert.equal(foreignCompanyOrder.status, 404);
  assert.equal(orderCreates.length, 1);
});
