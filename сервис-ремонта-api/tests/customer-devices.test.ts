import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCustomerDevicesRouter } from "../src/features/customers/devices.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("customer devices are private, editable, and deletable by their owner", async (t) => {
  const customerId = "11111111-1111-4111-8111-111111111111";
  const otherCustomerId = "22222222-2222-4222-8222-222222222222";
  const deviceId = "33333333-3333-4333-8333-333333333333";
  const customerToken = "C".repeat(48);
  const otherToken = "O".repeat(48);
  const users = [
    {
      id: customerId,
      email: "owner@example.test",
      displayName: "Владелец",
      phoneNumber: null,
      gender: null,
      birthDate: null,
      telegramChatId: null,
      maxUserId: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
    },
    {
      id: otherCustomerId,
      email: "other@example.test",
      displayName: "Другой клиент",
      phoneNumber: null,
      gender: null,
      birthDate: null,
      telegramChatId: null,
      maxUserId: null,
      avatarObjectId: null,
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
    },
  ];
  const tokens = new Map([
    [hashSessionToken(customerToken), users[0]!],
    [hashSessionToken(otherToken), users[1]!],
  ]);
  const devices: Record<string, unknown>[] = [
    {
      id: deviceId,
      customerId,
      deviceType: "LAPTOP",
      nickname: "Рабочий ноутбук",
      brand: "Lenovo",
      model: "ThinkPad",
      serialNumber: "SERIAL-1",
      nextMaintenanceAt: null,
      maintenanceNote: null,
      repairOrders: [],
    },
  ];
  let deleteCount = 0;
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = tokens.get(where.tokenHash);
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    customerDevice: {
      findMany: async ({ where }: { where: { customerId: string } }) =>
        devices.filter((device) => device.customerId === where.customerId),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const device = { id: deviceId, ...data, repairOrders: [] };
        devices.push(device);
        return device;
      },
      findFirst: async ({
        where,
      }: {
        where: { id: string; customerId: string };
      }) =>
        devices.find(
          (device) =>
            device.id === where.id && device.customerId === where.customerId,
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
      deleteMany: async ({
        where,
      }: {
        where: { id: string; customerId: string };
      }) => {
        const index = devices.findIndex(
          (device) =>
            device.id === where.id && device.customerId === where.customerId,
        );
        if (index < 0) return { count: 0 };
        devices.splice(index, 1);
        deleteCount += 1;
        return { count: 1 };
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.log = { error: () => undefined } as typeof request.log;
    next();
  });
  app.use(
    "/api",
    createCustomerDevicesRouter(client as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/customer/devices`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });

  const ownerList = await fetch(baseUrl, { headers: headers(customerToken) });
  assert.equal(ownerList.status, 200);
  assert.deepEqual(
    ((await ownerList.json()) as { devices: { id: string }[] }).devices.map(
      ({ id }) => id,
    ),
    [deviceId],
  );
  const otherList = await fetch(baseUrl, { headers: headers(otherToken) });
  assert.equal(otherList.status, 200);
  assert.deepEqual((await otherList.json()).devices, []);

  const forbiddenEdit = await fetch(`${baseUrl}/${deviceId}`, {
    method: "PATCH",
    headers: { ...headers(otherToken), "content-type": "application/json" },
    body: JSON.stringify({ nextMaintenanceAt: "2026-11-01" }),
  });
  assert.equal(forbiddenEdit.status, 404);
  assert.equal(devices[0]?.nextMaintenanceAt, null);

  const saveReminder = await fetch(`${baseUrl}/${deviceId}`, {
    method: "PATCH",
    headers: { ...headers(customerToken), "content-type": "application/json" },
    body: JSON.stringify({
      nextMaintenanceAt: "2026-11-01",
      maintenanceNote: "Профилактика",
    }),
  });
  assert.equal(saveReminder.status, 200);
  assert.equal(devices[0]?.maintenanceNote, "Профилактика");

  const forbiddenDelete = await fetch(`${baseUrl}/${deviceId}`, {
    method: "DELETE",
    headers: headers(otherToken),
  });
  assert.equal(forbiddenDelete.status, 404);
  assert.equal(deleteCount, 0);

  const deleted = await fetch(`${baseUrl}/${deviceId}`, {
    method: "DELETE",
    headers: headers(customerToken),
  });
  assert.equal(deleted.status, 204);
  assert.equal(deleteCount, 1);
});
