import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerDevicesRouter } from "../src/features/customers/devices.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("company devices stay separate from personal devices and cannot be spoofed", async (t) => {
  const ownerId = "11111111-1111-4111-8111-111111111111";
  const otherId = "22222222-2222-4222-8222-222222222222";
  const profileId = "33333333-3333-4333-8333-333333333333";
  const personalDeviceId = "44444444-4444-4444-8444-444444444444";
  const companyDeviceId = "55555555-5555-4555-8555-555555555555";
  const tokens = new Map([
    ["O".repeat(48), { id: ownerId, role: "CUSTOMER" as const }],
    ["C".repeat(48), { id: otherId, role: "CUSTOMER" as const }],
  ]);
  const devices: Record<string, any>[] = [
    {
      id: personalDeviceId,
      customerId: ownerId,
      businessProfileId: null,
      deviceType: "LAPTOP",
      nickname: "Личный ноутбук",
      repairOrders: [],
    },
    {
      id: companyDeviceId,
      customerId: ownerId,
      businessProfileId: profileId,
      deviceType: "COMPUTER",
      nickname: "Рабочая станция",
      repairOrders: [],
    },
  ];
  let nextDeviceId = 0;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = [...tokens.entries()].find(
          ([token]) => hashSessionToken(token) === where.tokenHash,
        )?.[1];
        return user
          ? {
              expiresAt: new Date(Date.now() + 60_000),
              user: {
                email: null,
                login: null,
                displayName: user.role,
                phoneNumber: null,
                gender: null,
                birthDate: null,
                telegramChatId: null,
                maxUserId: null,
                avatarObjectId: null,
                active: true,
                mustChangePassword: false,
                ...user,
              },
            }
          : null;
      },
    },
    customerBusinessProfile: {
      findUnique: async ({ where }: { where: { ownerUserId: string } }) =>
        where.ownerUserId === ownerId ? { id: profileId } : null,
    },
    customerDevice: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        devices.filter(
          (device) =>
            device.customerId === where.customerId &&
            device.businessProfileId === where.businessProfileId,
        ),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        nextDeviceId += 1;
        const device = {
          id:
            `${nextDeviceId}`.padStart(8, "0") + "-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          ...data,
          repairOrders: [],
        };
        devices.push(device);
        return device;
      },
      findFirst: async ({ where }: { where: Record<string, unknown> }) =>
        devices.find(
          (device) =>
            device.id === where.id &&
            device.customerId === where.customerId &&
            device.businessProfileId === where.businessProfileId,
        ) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const device = devices.find((item) => item.id === where.id)!;
        Object.assign(device, data);
        return device;
      },
      deleteMany: async ({ where }: { where: Record<string, unknown> }) => {
        const index = devices.findIndex(
          (device) =>
            device.id === where.id &&
            device.customerId === where.customerId &&
            device.businessProfileId === where.businessProfileId,
        );
        if (index < 0) return { count: 0 };
        devices.splice(index, 1);
        return { count: 1 };
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCustomerDevicesRouter(database as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/customer/devices`;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  const personalList = await fetch(endpoint, { headers: auth("O".repeat(48)) });
  assert.deepEqual(
    ((await personalList.json()) as { devices: { id: string }[] }).devices.map(
      (device) => device.id,
    ),
    [personalDeviceId],
  );
  const companyList = await fetch(`${endpoint}?scope=business`, {
    headers: auth("O".repeat(48)),
  });
  assert.deepEqual(
    ((await companyList.json()) as { devices: { id: string }[] }).devices.map(
      (device) => device.id,
    ),
    [companyDeviceId],
  );

  const created = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...auth("O".repeat(48)),
      "content-type": "application/json",
    },
    body: JSON.stringify({ deviceType: "MONOBLOCK", scope: "business" }),
  });
  assert.equal(created.status, 201);
  const createdDevice = (await created.json()).device;
  assert.equal(createdDevice.businessProfileId, profileId);
  assert.equal(createdDevice.customerId, ownerId);

  const companyPatchOfPersonalDevice = await fetch(
    `${endpoint}/${personalDeviceId}?scope=business`,
    {
      method: "PATCH",
      headers: {
        ...auth("O".repeat(48)),
        "content-type": "application/json",
      },
      body: JSON.stringify({ nickname: "Подмена" }),
    },
  );
  assert.equal(companyPatchOfPersonalDevice.status, 404);
  assert.equal(devices[0]?.nickname, "Личный ноутбук");

  const otherCompanyList = await fetch(`${endpoint}?scope=business`, {
    headers: auth("C".repeat(48)),
  });
  assert.equal(otherCompanyList.status, 200);
  assert.deepEqual((await otherCompanyList.json()).devices, []);

  const otherCompanyCreate = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...auth("C".repeat(48)),
      "content-type": "application/json",
    },
    body: JSON.stringify({ deviceType: "COMPUTER", scope: "business" }),
  });
  assert.equal(otherCompanyCreate.status, 404);
  const otherCompanyDelete = await fetch(
    `${endpoint}/${personalDeviceId}?scope=business`,
    { method: "DELETE", headers: auth("C".repeat(48)) },
  );
  assert.equal(otherCompanyDelete.status, 404);
  assert.equal(
    devices.some((device) => device.id === personalDeviceId),
    true,
  );
});
