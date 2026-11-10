import express from "express";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { assertWorkActApproved } from "../src/features/orders/repair-work-act.shared.js";
import { createRepairWorkActsRouter } from "../src/features/orders/repair-work-acts.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";
import { HttpError } from "../src/lib/http/http-error.js";

test("new repair finalization requires an administrator-approved work act", () => {
  assert.doesNotThrow(() => assertWorkActApproved(false, null));
  assert.doesNotThrow(() => assertWorkActApproved(true, "APPROVED"));

  for (const status of [undefined, null, "DRAFT", "PENDING"] as const) {
    assert.throws(
      () => assertWorkActApproved(true, status),
      (error: unknown) =>
        error instanceof HttpError &&
        error.status === 409 &&
        error.code === "WORK_ACT_APPROVAL_REQUIRED",
    );
  }
});

test("technician drafts the work act without stock changes; administrator approves only selected lines", async (t) => {
  const orderId = "11111111-1111-4111-8111-111111111111";
  const serviceId = "22222222-2222-4222-8222-222222222222";
  const oldPartId = "33333333-3333-4333-8333-333333333333";
  const newPartId = "44444444-4444-4444-8444-444444444444";
  const serviceLineId = "55555555-5555-4555-8555-555555555555";
  const oldPartLineId = "66666666-6666-4666-8666-666666666666";
  const adminId = "77777777-7777-4777-8777-777777777777";
  const technicianId = "88888888-8888-4888-8888-888888888888";
  const customerId = "99999999-9999-4999-8999-999999999999";
  const newLineId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const adminToken = "A".repeat(48);
  const technicianToken = "T".repeat(48);
  const customerToken = "C".repeat(48);
  const users = [
    {
      id: adminId,
      email: "admin@example.test",
      displayName: "Администратор",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
    },
    {
      id: technicianId,
      email: "master@example.test",
      displayName: "Мастер",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
    },
    {
      id: customerId,
      email: "client@example.test",
      displayName: "Клиент",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
    },
  ];
  const tokenUsers = new Map([
    [hashSessionToken(adminToken), users[0]!],
    [hashSessionToken(technicianToken), users[1]!],
    [hashSessionToken(customerToken), users[2]!],
  ]);
  const order = {
    id: orderId,
    customerId,
    assignedTechnicianId: technicianId,
    serviceNumber: "S-301",
    deviceType: "COMPUTER",
    status: "IN_PROGRESS",
    workActRequired: false,
    receipt: null,
  };
  const service = {
    id: serviceId,
    type: "SERVICE",
    name: "Диагностика",
    unitPriceRub: 1500,
    active: true,
    deviceTypes: ["COMPUTER"],
  };
  const oldPart = {
    id: oldPartId,
    type: "SPARE_PART",
    name: "Старый модуль",
    unitPriceRub: 3000,
    active: true,
    deviceTypes: ["COMPUTER"],
    stockQuantity: 4,
  };
  const newPart = {
    id: newPartId,
    type: "SPARE_PART",
    name: "Новый модуль",
    unitPriceRub: 5000,
    active: true,
    deviceTypes: ["COMPUTER"],
    stockQuantity: 3,
  };
  const catalog = new Map([
    [serviceId, service],
    [oldPartId, oldPart],
    [newPartId, newPart],
  ]);
  const stock = new Map([
    [oldPartId, 4],
    [newPartId, 3],
  ]);
  const orderItems: Array<Record<string, any>> = [
    {
      id: serviceLineId,
      orderId,
      catalogItemId: serviceId,
      type: "SERVICE",
      name: "Диагностика",
      quantity: 1,
      unitPriceRub: 1500,
      addedById: technicianId,
      createdAt: new Date(1),
    },
    {
      id: oldPartLineId,
      orderId,
      catalogItemId: oldPartId,
      type: "SPARE_PART",
      name: "Старый модуль",
      quantity: 1,
      unitPriceRub: 3000,
      addedById: technicianId,
      createdAt: new Date(2),
    },
  ];
  let act: Record<string, any> | null = null;
  const transaction = {} as Record<string, any>;
  const client = {
    $queryRaw: async () => [],
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = tokenUsers.get(where.tokenHash);
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    user: { findMany: async () => [], findUnique: async () => null },
    pushDeviceToken: { findMany: async () => [] },
    repairOrder: {
      findUnique: async () => ({ ...order, items: orderItems, workAct: act }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => {
        Object.assign(order, data);
        return { count: 1 };
      },
    },
    repairCatalogItem: {
      findMany: async ({
        where,
      }: {
        where: { id: { in: string[] }; active?: boolean };
      }) =>
        where.id.in.flatMap((id) => {
          const item = catalog.get(id);
          return item && (!where.active || item.active)
            ? [{ ...item, stockQuantity: stock.get(id) ?? null }]
            : [];
        }),
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; stockQuantity?: { gte: number } };
        data: { stockQuantity: { increment?: number; decrement?: number } };
      }) => {
        const current = stock.get(where.id);
        if (
          current === undefined ||
          (where.stockQuantity && current < where.stockQuantity.gte)
        )
          return { count: 0 };
        stock.set(
          where.id,
          current +
            (data.stockQuantity.increment ?? 0) -
            (data.stockQuantity.decrement ?? 0),
        );
        return { count: 1 };
      },
    },
    repairWorkAct: {
      create: async ({ data }: { data: Record<string, any> }) => {
        act = {
          id: randomUUID(),
          status: "DRAFT",
          ...data,
          approvedItemsSnapshot: null,
          removedItemsSnapshot: null,
          submittedAt: null,
          approvedAt: null,
          createdBy: { id: technicianId, displayName: "Мастер" },
          approvedBy: null,
        };
        return act;
      },
      findUnique: async () => act,
      findUniqueOrThrow: async () => act,
      updateMany: async ({
        where,
        data,
      }: {
        where: { status?: string; revision?: number };
        data: Record<string, any>;
      }) => {
        if (
          !act ||
          (where.status && act.status !== where.status) ||
          (where.revision !== undefined && act.revision !== where.revision)
        )
          return { count: 0 };
        const nextData = { ...data };
        if (data.revision?.increment) {
          act.revision += data.revision.increment;
          delete nextData.revision;
        }
        Object.assign(act, nextData);
        return { count: 1 };
      },
    },
    repairOrderItem: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const item = { id: randomUUID(), ...data, createdAt: new Date() };
        orderItems.push(item);
        return item;
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        const before = orderItems.length;
        for (let index = orderItems.length - 1; index >= 0; index -= 1) {
          if (where.id.in.includes(orderItems[index]!.id))
            orderItems.splice(index, 1);
        }
        return { count: before - orderItems.length };
      },
    },
    repairEstimate: { updateMany: async () => ({ count: 0 }) },
    repairStatusEvent: { create: async () => ({ createdAt: new Date() }) },
    $transaction: async <T>(operation: (tx: unknown) => Promise<T>) =>
      operation(transaction),
  };
  Object.assign(transaction, client);
  const app = express();
  app.use(express.json());
  app.use((request, _response, next) => {
    request.log = {
      error: (details, message) => console.error(message, details),
    } as typeof request.log;
    next();
  });
  app.use(
    "/api",
    createRepairWorkActsRouter(client as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/api/orders/${orderId}/work-act`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });
  const draft = [
    {
      lineId: serviceLineId,
      orderItemId: serviceLineId,
      catalogItemId: serviceId,
      quantity: 1,
    },
    {
      lineId: oldPartLineId,
      orderItemId: oldPartLineId,
      catalogItemId: oldPartId,
      quantity: 1,
    },
    {
      lineId: newLineId,
      orderItemId: null,
      catalogItemId: newPartId,
      quantity: 2,
    },
  ];

  const saved = await fetch(base, {
    method: "PUT",
    headers: headers(technicianToken),
    body: JSON.stringify({ expectedRevision: 0, items: draft }),
  });
  assert.equal(saved.status, 200);
  assert.equal(order.workActRequired, true);
  assert.equal(stock.get(oldPartId), 4);
  assert.equal(stock.get(newPartId), 3);
  assert.equal(orderItems.length, 2);

  const staleSave = await fetch(base, {
    method: "PUT",
    headers: headers(technicianToken),
    body: JSON.stringify({ expectedRevision: 0, items: draft }),
  });
  assert.equal(staleSave.status, 409);

  const submitted = await fetch(`${base}/submit`, {
    method: "PATCH",
    headers: headers(technicianToken),
    body: JSON.stringify({ expectedRevision: 1 }),
  });
  assert.equal(submitted.status, 200);
  assert.equal(stock.get(oldPartId), 4);
  assert.equal(stock.get(newPartId), 3);
  assert.equal(act?.status, "PENDING");

  const technicianReview = await fetch(`${base}/review`, {
    method: "PATCH",
    headers: headers(technicianToken),
    body: JSON.stringify({
      expectedRevision: 2,
      includedLineIds: [serviceLineId, newLineId],
    }),
  });
  assert.equal(technicianReview.status, 403);

  const customerReview = await fetch(`${base}/review`, {
    method: "PATCH",
    headers: headers(customerToken),
    body: JSON.stringify({
      expectedRevision: 2,
      includedLineIds: [serviceLineId, newLineId],
    }),
  });
  assert.equal(customerReview.status, 403);

  const approved = await fetch(`${base}/review`, {
    method: "PATCH",
    headers: headers(adminToken),
    body: JSON.stringify({
      expectedRevision: 2,
      includedLineIds: [serviceLineId, newLineId],
    }),
  });
  assert.equal(approved.status, 200);
  assert.equal(stock.get(oldPartId), 5);
  assert.equal(stock.get(newPartId), 1);
  assert.equal(
    orderItems.some((item) => item.id === serviceLineId),
    true,
  );
  assert.equal(
    orderItems.some((item) => item.catalogItemId === newPartId),
    true,
  );
  assert.equal(
    orderItems.some((item) => item.id === oldPartLineId),
    false,
  );
  assert.equal(act?.status, "APPROVED");
  assert.equal((act?.removedItemsSnapshot as Array<unknown>).length, 1);
  assert.equal((act?.approvedItemsSnapshot as Array<unknown>).length, 2);
});
