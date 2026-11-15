import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCatalogRouter } from "../src/features/catalog/catalog.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "A".repeat(48);
const technicianToken = "T".repeat(48);
const customerToken = "C".repeat(48);
const procurementToken = "P".repeat(48);

test("only administrators manage the shared catalog and technicians see active prices", async (t) => {
  const users = [
    {
      id: "admin-1",
      email: "admin@test.invalid",
      displayName: "Admin",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: "tech-1",
      email: "tech@test.invalid",
      displayName: "Technician",
      role: "TECHNICIAN" as const,
      active: true,
      mustChangePassword: false,
      token: technicianToken,
    },
    {
      id: "customer-1",
      email: "customer@test.invalid",
      displayName: "Customer",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
    {
      id: "buyer-1",
      email: "buyer@test.invalid",
      displayName: "Buyer",
      role: "PROCUREMENT" as const,
      active: true,
      mustChangePassword: false,
      token: procurementToken,
    },
  ];
  const items = [
    {
      id: "33333333-3333-4333-8333-333333333334",
      type: "SERVICE",
      name: "Диагностика",
      unitPriceRub: 1800,
      deviceTypes: ["COMPUTER", "LAPTOP", "PHONE", "TABLET"],
      stockQuantity: null,
      active: true,
      createdById: "admin-1",
    },
    {
      id: "33333333-3333-4333-8333-333333333335",
      type: "SPARE_PART",
      name: "Старый аккумулятор",
      unitPriceRub: 4500,
      stockQuantity: null,
      active: false,
      createdById: "admin-1",
    },
    {
      id: "33333333-3333-4333-8333-333333333336",
      type: "SPARE_PART",
      name: "Активный аккумулятор",
      unitPriceRub: 4500,
      stockQuantity: 2,
      active: true,
      createdById: "admin-1",
    },
    {
      id: "33333333-3333-4333-8333-333333333337",
      type: "PRODUCT",
      name: "Кабель USB-C",
      unitPriceRub: 900,
      stockQuantity: 8,
      minimumStockQuantity: 3,
      active: true,
      createdById: "admin-1",
    },
  ];
  const activeCatalogItemId = "33333333-3333-4333-8333-333333333334";
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        return user ? { expiresAt: new Date(Date.now() + 60_000), user } : null;
      },
    },
    repairCatalogItem: {
      findMany: async ({
        where,
        select,
      }: {
        where: {
          active?: boolean;
          type?: string | { in: string[] };
        };
        select?: { id?: boolean; name?: boolean; unitPriceRub?: boolean };
      }) => {
        const matches = items.filter(
          (item) =>
            (where.active === undefined || item.active === where.active) &&
            (where.type === undefined ||
              (typeof where.type === "string"
                ? item.type === where.type
                : where.type.in.includes(item.type))),
        );
        return select
          ? matches.map(({ id, name, unitPriceRub }) => ({
              id,
              name,
              unitPriceRub,
            }))
          : matches;
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const created = {
          id: `33333333-3333-4333-8333-${String(items.length + 1).padStart(12, "0")}`,
          ...data,
          active: true,
        };
        items.push(created as (typeof items)[number]);
        return created;
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        items.find((item) => item.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const found = items.find((item) => item.id === where.id);
        assert.ok(found);
        Object.assign(found, data);
        return found;
      },
    },
    shopOrderItem: {
      findFirst: async () => null,
    },
    $queryRaw: async () => [],
    $transaction: async (operation: (transaction: unknown) => unknown) =>
      operation(client),
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createCatalogRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/catalog`;
  const headers = (token: string) => ({
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
  });

  const adminList = await fetch(baseUrl, { headers: headers(adminToken) });
  assert.equal(adminList.status, 200);
  assert.equal((await adminList.json()).catalogItems.length, 4);

  const technicianList = await fetch(baseUrl, {
    headers: headers(technicianToken),
  });
  assert.equal(technicianList.status, 200);
  assert.deepEqual(
    (await technicianList.json()).catalogItems.map(
      (entry: { name: string }) => entry.name,
    ),
    ["Диагностика", "Активный аккумулятор", "Кабель USB-C"],
  );

  const procurementList = await fetch(baseUrl, {
    headers: headers(procurementToken),
  });
  assert.equal(procurementList.status, 200);
  assert.deepEqual(
    (await procurementList.json()).catalogItems.map(
      (entry: { name: string }) => entry.name,
    ),
    ["Активный аккумулятор", "Кабель USB-C"],
  );

  const customerList = await fetch(baseUrl, {
    headers: headers(customerToken),
  });
  assert.equal(customerList.status, 403);

  const procurementServiceUpdate = await fetch(
    `${baseUrl}/33333333-3333-4333-8333-333333333334/inventory`,
    {
      method: "PATCH",
      headers: headers(procurementToken),
      body: JSON.stringify({ stockQuantity: 3 }),
    },
  );
  assert.equal(procurementServiceUpdate.status, 404);

  const procurementStockUpdate = await fetch(
    `${baseUrl}/33333333-3333-4333-8333-333333333336/inventory`,
    {
      method: "PATCH",
      headers: headers(procurementToken),
      body: JSON.stringify({ stockQuantity: 12, minimumStockQuantity: 6 }),
    },
  );
  assert.equal(procurementStockUpdate.status, 200);
  const updatedStock = (await procurementStockUpdate.json()).catalogItem;
  assert.equal(updatedStock.stockQuantity, 12);
  assert.equal(updatedStock.minimumStockQuantity, 6);
  assert.equal(updatedStock.unitPriceRub, 4500);

  const procurementPriceUpdate = await fetch(
    `${baseUrl}/33333333-3333-4333-8333-333333333336/inventory`,
    {
      method: "PATCH",
      headers: headers(procurementToken),
      body: JSON.stringify({ unitPriceRub: 1 }),
    },
  );
  assert.equal(procurementPriceUpdate.status, 400);

  const procurementInactiveUpdate = await fetch(
    `${baseUrl}/33333333-3333-4333-8333-333333333335/inventory`,
    {
      method: "PATCH",
      headers: headers(procurementToken),
      body: JSON.stringify({ stockQuantity: 1 }),
    },
  );
  assert.equal(procurementInactiveUpdate.status, 404);

  const technicianInventoryUpdate = await fetch(
    `${baseUrl}/33333333-3333-4333-8333-333333333336/inventory`,
    {
      method: "PATCH",
      headers: headers(technicianToken),
      body: JSON.stringify({ stockQuantity: 3 }),
    },
  );
  assert.equal(technicianInventoryUpdate.status, 403);

  const customerPrices = await fetch(
    "http://127.0.0.1:" + address.port + "/api/customer/service-prices",
    { headers: headers(customerToken) },
  );
  assert.equal(customerPrices.status, 200);
  assert.deepEqual((await customerPrices.json()).prices, [
    {
      id: "33333333-3333-4333-8333-333333333334",
      name: "Диагностика",
      unitPriceRub: 1800,
    },
  ]);
  const technicianPrices = await fetch(
    "http://127.0.0.1:" + address.port + "/api/customer/service-prices",
    { headers: headers(technicianToken) },
  );
  assert.equal(technicianPrices.status, 403);

  const publicPrices = await fetch(
    "http://127.0.0.1:" + address.port + "/api/public/service-prices",
  );
  assert.equal(publicPrices.status, 200);
  assert.deepEqual((await publicPrices.json()).prices, [
    {
      id: "33333333-3333-4333-8333-333333333334",
      name: "Диагностика",
      unitPriceRub: 1800,
    },
  ]);

  const createItem = await fetch(baseUrl, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify({
      type: "SPARE_PART",
      name: "SSD 1 ТБ",
      unitPriceRub: 8500,
    }),
  });
  assert.equal(createItem.status, 201);
  const createdSparePart = (await createItem.json()).catalogItem;
  assert.equal(createdSparePart.createdById, "admin-1");
  assert.equal(createdSparePart.stockQuantity, 0);
  assert.equal(createdSparePart.minimumStockQuantity, 3);
  assert.deepEqual(createdSparePart.deviceTypes, ["COMPUTER", "LAPTOP"]);

  for (const deviceType of ["PHONE", "TABLET"]) {
    const unsupportedCatalogItem = await fetch(baseUrl, {
      method: "POST",
      headers: headers(adminToken),
      body: JSON.stringify({
        type: "SERVICE",
        name: `Услуга для ${deviceType}`,
        unitPriceRub: 1,
        deviceTypes: [deviceType],
      }),
    });
    assert.equal(unsupportedCatalogItem.status, 400);
  }

  const createProduct = await fetch(baseUrl, {
    method: "POST",
    headers: headers(adminToken),
    body: JSON.stringify({
      type: "PRODUCT",
      name: "Кабель USB-C",
      unitPriceRub: 900,
      stockQuantity: 8,
      minimumStockQuantity: 5,
    }),
  });
  assert.equal(createProduct.status, 201);
  const createdProduct = (await createProduct.json()).catalogItem;
  assert.equal(createdProduct.type, "PRODUCT");
  assert.equal(createdProduct.stockQuantity, 8);
  assert.equal(createdProduct.minimumStockQuantity, 5);
  const productStockUpdate = await fetch(`${baseUrl}/${createdProduct.id}`, {
    method: "PATCH",
    headers: headers(adminToken),
    body: JSON.stringify({ stockQuantity: 12 }),
  });
  assert.equal(productStockUpdate.status, 200);
  assert.equal((await productStockUpdate.json()).catalogItem.stockQuantity, 12);
  const thresholdUpdate = await fetch(`${baseUrl}/${createdProduct.id}`, {
    method: "PATCH",
    headers: headers(adminToken),
    body: JSON.stringify({ minimumStockQuantity: 7 }),
  });
  assert.equal(thresholdUpdate.status, 200);
  assert.equal(
    (await thresholdUpdate.json()).catalogItem.minimumStockQuantity,
    7,
  );

  const unsupportedDeviceTypeUpdate = await fetch(
    `${baseUrl}/${activeCatalogItemId}`,
    {
      method: "PATCH",
      headers: headers(adminToken),
      body: JSON.stringify({ deviceTypes: ["COMPUTER", "PHONE"] }),
    },
  );
  assert.equal(unsupportedDeviceTypeUpdate.status, 400);

  const preservedHistoricalDeviceTypes = await fetch(
    `${baseUrl}/${activeCatalogItemId}`,
    {
      method: "PATCH",
      headers: headers(adminToken),
      body: JSON.stringify({ deviceTypes: ["LAPTOP"] }),
    },
  );
  assert.equal(preservedHistoricalDeviceTypes.status, 200);
  assert.deepEqual(
    (await preservedHistoricalDeviceTypes.json()).catalogItem.deviceTypes,
    ["LAPTOP", "PHONE", "TABLET"],
  );

  const stockUpdate = await fetch(
    `${baseUrl}/33333333-3333-4333-8333-333333333335`,
    {
      method: "PATCH",
      headers: headers(adminToken),
      body: JSON.stringify({ stockQuantity: 12 }),
    },
  );
  assert.equal(stockUpdate.status, 200);
  assert.equal((await stockUpdate.json()).catalogItem.stockQuantity, 12);

  const serviceStockUpdate = await fetch(`${baseUrl}/${activeCatalogItemId}`, {
    method: "PATCH",
    headers: headers(adminToken),
    body: JSON.stringify({ stockQuantity: 12 }),
  });
  assert.equal(serviceStockUpdate.status, 400);
  const serviceThresholdUpdate = await fetch(
    `${baseUrl}/${activeCatalogItemId}`,
    {
      method: "PATCH",
      headers: headers(adminToken),
      body: JSON.stringify({ minimumStockQuantity: 5 }),
    },
  );
  assert.equal(serviceThresholdUpdate.status, 400);

  const technicianCreate = await fetch(baseUrl, {
    method: "POST",
    headers: headers(technicianToken),
    body: JSON.stringify({
      type: "SERVICE",
      name: "Не разрешено",
      unitPriceRub: 1,
    }),
  });
  assert.equal(technicianCreate.status, 403);

  const technicianUpdate = await fetch(`${baseUrl}/${activeCatalogItemId}`, {
    method: "PATCH",
    headers: headers(technicianToken),
    body: JSON.stringify({ active: false }),
  });
  assert.equal(technicianUpdate.status, 403);

  const adminUpdate = await fetch(`${baseUrl}/${activeCatalogItemId}`, {
    method: "PATCH",
    headers: headers(adminToken),
    body: JSON.stringify({ unitPriceRub: 2100, active: false }),
  });
  assert.equal(adminUpdate.status, 200);
  assert.equal((await adminUpdate.json()).catalogItem.unitPriceRub, 2100);

  const updatedTechnicianList = await fetch(baseUrl, {
    headers: headers(technicianToken),
  });
  const available = (await updatedTechnicianList.json()).catalogItems;
  assert.equal(
    available.some((entry: { id: string }) => entry.id === activeCatalogItemId),
    false,
  );
});
