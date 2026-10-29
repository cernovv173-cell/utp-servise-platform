import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createProcurementRouter } from "../src/features/procurement/procurement.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "A".repeat(48);
const procurementToken = "P".repeat(48);
const customerToken = "C".repeat(48);
const supplierId = "11111111-1111-4111-8111-111111111111";
const itemId = "22222222-2222-4222-8222-222222222222";
const untrackedItemId = "33333333-3333-4333-8333-333333333333";

test("procurement staff manage suppliers and record stock receipts atomically", async (t) => {
  const users = [
    { id: "admin", token: adminToken, role: "ADMIN" as const },
    { id: "buyer", token: procurementToken, role: "PROCUREMENT" as const },
    { id: "customer", token: customerToken, role: "CUSTOMER" as const },
  ];
  const now = new Date("2026-10-29T10:00:00.000Z");
  const suppliers = [
    {
      id: supplierId,
      name: "Радиодетали",
      contactName: null,
      phone: "+7 900 000-00-00",
      email: null,
      note: null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      name: "Архивный поставщик",
      contactName: null,
      phone: null,
      email: null,
      note: null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
    },
  ];
  const catalog = new Map([
    [
      itemId,
      {
        id: itemId,
        type: "SPARE_PART",
        name: "Аккумулятор",
        active: true,
        stockQuantity: 2,
      },
    ],
    [
      untrackedItemId,
      {
        id: untrackedItemId,
        type: "PRODUCT",
        name: "Кабель USB-C",
        active: true,
        stockQuantity: null,
      },
    ],
  ]);
  const receipts: Array<Record<string, unknown>> = [];
  let nextId = 1;

  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (candidate) => hashSessionToken(candidate.token) === where.tokenHash,
        );
        return user
          ? {
              expiresAt: new Date(Date.now() + 60_000),
              user: {
                ...user,
                email: `${user.role.toLowerCase()}@test.invalid`,
                displayName: user.role,
                phoneNumber: null,
                gender: null,
                birthDate: null,
                telegramChatId: null,
                maxUserId: null,
                avatarObjectId: null,
                salaryRatePercent: 75,
                active: true,
                mustChangePassword: false,
              },
            }
          : null;
      },
    },
    procurementSupplier: {
      findMany: async () => suppliers,
      findFirst: async ({
        where,
      }: {
        where: { id: string; isActive: boolean };
      }) =>
        suppliers.find(
          (supplier) =>
            supplier.id === where.id && supplier.isActive === where.isActive,
        ) ?? null,
      findUnique: async ({ where }: { where: { id: string } }) =>
        suppliers.find((supplier) => supplier.id === where.id) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const supplier = {
          id: `supplier-${nextId++}`,
          name: data.name as string,
          contactName: (data.contactName as string | null) ?? null,
          phone: (data.phone as string | null) ?? null,
          email: (data.email as string | null) ?? null,
          note: (data.note as string | null) ?? null,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        };
        suppliers.push(supplier);
        return supplier;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const supplier = suppliers.find(
          (candidate) => candidate.id === where.id,
        )!;
        Object.assign(supplier, data, { updatedAt: now });
        return supplier;
      },
    },
    repairCatalogItem: {
      findUnique: async ({ where }: { where: { id: string } }) =>
        catalog.get(where.id) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: {
          id: string;
          active: boolean;
          stockQuantity: { not: null; lte: number };
        };
        data: { stockQuantity: { increment: number } };
      }) => {
        const item = catalog.get(where.id);
        if (
          !item ||
          !item.active ||
          item.stockQuantity === null ||
          item.stockQuantity > where.stockQuantity.lte
        ) {
          return { count: 0 };
        }
        item.stockQuantity += data.stockQuantity.increment;
        return { count: 1 };
      },
    },
    inventoryStockReceipt: {
      findMany: async () => [...receipts].reverse(),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const receipt = {
          id: `receipt-${nextId++}`,
          ...data,
          receivedAt: now,
        };
        receipts.push(receipt);
        return receipt;
      },
    },
    $transaction: async <T>(callback: (transaction: unknown) => Promise<T>) =>
      callback(client),
  } as unknown as DatabaseClient;

  const app = express();
  app.use(express.json());
  app.use(createProcurementRouter(client));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test port");
  const baseUrl = `http://127.0.0.1:${address.port}/admin/operations`;
  const headers = (token: string) => ({ Authorization: `Bearer ${token}` });

  const denied = await fetch(`${baseUrl}/suppliers`, {
    headers: headers(customerToken),
  });
  assert.equal(denied.status, 403);

  const createdSupplier = await fetch(`${baseUrl}/suppliers`, {
    method: "POST",
    headers: {
      ...headers(procurementToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "Новый поставщик",
      contactName: "Иван",
      phone: "+7 900 111-22-33",
      email: "shop@example.test",
    }),
  });
  assert.equal(createdSupplier.status, 201);
  const supplierBody = await createdSupplier.json();
  assert.equal(supplierBody.supplier.name, "Новый поставщик");
  assert.equal(supplierBody.supplier.isActive, true);

  const archived = await fetch(`${baseUrl}/suppliers/${supplierId}`, {
    method: "PATCH",
    headers: { ...headers(adminToken), "Content-Type": "application/json" },
    body: JSON.stringify({ isActive: false }),
  });
  assert.equal(archived.status, 200);
  assert.equal((await archived.json()).supplier.isActive, false);

  const inactiveSupplierReceipt = await fetch(`${baseUrl}/stock-receipts`, {
    method: "POST",
    headers: {
      ...headers(procurementToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ supplierId, catalogItemId: itemId, quantity: 1 }),
  });
  assert.equal(inactiveSupplierReceipt.status, 404);

  suppliers[0]!.isActive = true;
  const untrackedItemReceipt = await fetch(`${baseUrl}/stock-receipts`, {
    method: "POST",
    headers: {
      ...headers(procurementToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      supplierId,
      catalogItemId: untrackedItemId,
      quantity: 3,
    }),
  });
  assert.equal(untrackedItemReceipt.status, 409);
  assert.equal(catalog.get(untrackedItemId)?.stockQuantity, null);

  const receiptResponse = await fetch(`${baseUrl}/stock-receipts`, {
    method: "POST",
    headers: {
      ...headers(procurementToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      supplierId,
      catalogItemId: itemId,
      quantity: 4,
      unitCostRub: 250,
      documentReference: "Накладная 18",
    }),
  });
  assert.equal(receiptResponse.status, 201);
  const receiptBody = await receiptResponse.json();
  assert.equal(receiptBody.receipt.supplierNameSnapshot, "Радиодетали");
  assert.equal(receiptBody.receipt.itemNameSnapshot, "Аккумулятор");
  assert.equal(receiptBody.receipt.quantity, 4);
  assert.equal(receiptBody.receipt.unitCostRub, 250);
  assert.equal(catalog.get(itemId)?.stockQuantity, 6);
  assert.equal(receipts.length, 1);

  const receiptList = await fetch(`${baseUrl}/stock-receipts`, {
    headers: headers(adminToken),
  });
  assert.equal(receiptList.status, 200);
  assert.equal((await receiptList.json()).receipts.length, 1);

  const invalidQuantity = await fetch(`${baseUrl}/stock-receipts`, {
    method: "POST",
    headers: {
      ...headers(procurementToken),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ supplierId, catalogItemId: itemId, quantity: 0 }),
  });
  assert.equal(invalidQuantity.status, 400);
});
