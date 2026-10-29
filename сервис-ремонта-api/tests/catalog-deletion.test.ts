import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createCatalogRouter } from "../src/features/catalog/catalog.routes.js";
import type { MediaStorage } from "../src/features/media/media-storage.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminToken = "A".repeat(48);
const technicianToken = "T".repeat(48);
const serviceId = "33333333-3333-4333-8333-333333333334";
const untrackedSparePartId = "33333333-3333-4333-8333-333333333335";
const productId = "33333333-3333-4333-8333-333333333337";

test("permanent catalog deletion protects active work and preserves closed-order history", async (t) => {
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
  ];
  const items = [
    {
      id: serviceId,
      type: "SERVICE",
      name: "Диагностика",
      unitPriceRub: 1800,
      stockQuantity: null,
      imageObjectIds: [],
      active: true,
    },
    {
      id: untrackedSparePartId,
      type: "SPARE_PART",
      name: "Старый аккумулятор",
      unitPriceRub: 4500,
      stockQuantity: null,
      imageObjectIds: [],
      active: false,
    },
    {
      id: productId,
      type: "PRODUCT",
      name: "Кабель USB-C",
      unitPriceRub: 900,
      stockQuantity: 8,
      imageObjectIds: ["catalog-product-image"],
      active: true,
    },
  ];
  const repairOrderLines = [
    {
      id: "historical-repair-line",
      catalogItemId: serviceId as string | null,
      orderStatus: "COMPLETED",
      name: "Диагностика",
      unitPriceRub: 1800,
    },
  ];
  const pendingEstimateSnapshots: {
    orderStatus: string;
    itemsSnapshot: unknown;
  }[] = [];
  const shopOrderLines: {
    id: string;
    catalogItemId: string | null;
    orderStatus: string;
    stockDeducted: boolean;
    name: string;
    unitPriceRub: number;
  }[] = [
    {
      id: "historical-shop-line",
      catalogItemId: productId,
      orderStatus: "COMPLETED",
      stockDeducted: true,
      name: "Кабель USB-C",
      unitPriceRub: 900,
    },
  ];
  const deletedImageIds: string[] = [];
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
      delete: async ({ where }: { where: { id: string } }) => {
        const index = items.findIndex((item) => item.id === where.id);
        assert.notEqual(index, -1);
        const [deleted] = items.splice(index, 1);
        assert.ok(deleted);
        repairOrderLines.forEach((line) => {
          if (line.catalogItemId === where.id) line.catalogItemId = null;
        });
        shopOrderLines.forEach((line) => {
          if (line.catalogItemId === where.id) line.catalogItemId = null;
        });
        return deleted;
      },
    },
    repairOrderItem: {
      findFirst: async ({
        where,
      }: {
        where: {
          catalogItemId: string;
          order: { status: { notIn: string[] } };
        };
      }) => {
        const match = repairOrderLines.find(
          (line) =>
            line.catalogItemId === where.catalogItemId &&
            !where.order.status.notIn.includes(line.orderStatus),
        );
        return match ? { id: match.id } : null;
      },
    },
    repairEstimate: {
      findMany: async ({
        where,
      }: {
        where: { status: string; order: { status: { notIn: string[] } } };
      }) =>
        pendingEstimateSnapshots
          .filter(
            (estimate) =>
              where.status === "PENDING" &&
              !where.order.status.notIn.includes(estimate.orderStatus),
          )
          .map(({ itemsSnapshot }) => ({ itemsSnapshot })),
    },
    shopOrderItem: {
      findFirst: async ({
        where,
      }: {
        where: {
          catalogItemId: string;
          stockDeducted?: boolean;
          order: { status: string | { in: string[] } };
        };
      }) => {
        const match = shopOrderLines.find((line) => {
          const statusMatches =
            typeof where.order.status === "string"
              ? line.orderStatus === where.order.status
              : where.order.status.in.includes(line.orderStatus);
          return (
            line.catalogItemId === where.catalogItemId &&
            (where.stockDeducted === undefined ||
              line.stockDeducted === where.stockDeducted) &&
            statusMatches
          );
        });
        return match ? { id: match.id } : null;
      },
    },
    $queryRaw: async () => [],
    $transaction: async (operation: (transaction: unknown) => unknown) =>
      operation(client),
  };
  const storage = {
    upload: async () => "unused",
    delete: async (objectId: string) => {
      deletedImageIds.push(objectId);
    },
    download: async () => "unused",
  } as unknown as MediaStorage;
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createCatalogRouter(client as unknown as DatabaseClient, storage),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api/catalog`;
  const headers = (token: string) => ({ authorization: `Bearer ${token}` });
  const remove = (id: string, token = adminToken) =>
    fetch(`${baseUrl}/${id}`, { method: "DELETE", headers: headers(token) });

  assert.equal((await remove(serviceId, technicianToken)).status, 403);

  repairOrderLines.push({
    id: "open-repair-line",
    catalogItemId: serviceId,
    orderStatus: "IN_PROGRESS",
    name: "Диагностика",
    unitPriceRub: 1800,
  });
  assert.equal((await remove(serviceId)).status, 409);
  repairOrderLines.pop();

  pendingEstimateSnapshots.push({
    orderStatus: "ASSIGNED",
    itemsSnapshot: [{ catalogItemId: serviceId }],
  });
  assert.equal((await remove(serviceId)).status, 409);
  pendingEstimateSnapshots.pop();

  assert.equal((await remove(serviceId)).status, 204);
  assert.equal(
    items.some((item) => item.id === serviceId),
    false,
  );
  assert.deepEqual(repairOrderLines[0], {
    id: "historical-repair-line",
    catalogItemId: null,
    orderStatus: "COMPLETED",
    name: "Диагностика",
    unitPriceRub: 1800,
  });

  assert.equal((await remove(untrackedSparePartId)).status, 409);
  const setSparePartStockToZero = await fetch(
    `${baseUrl}/${untrackedSparePartId}/inventory`,
    {
      method: "PATCH",
      headers: { ...headers(adminToken), "content-type": "application/json" },
      body: JSON.stringify({ stockQuantity: 0 }),
    },
  );
  assert.equal(setSparePartStockToZero.status, 200);
  assert.equal((await remove(untrackedSparePartId)).status, 204);

  assert.equal((await remove(productId)).status, 409);
  const clearProductStock = await fetch(`${baseUrl}/${productId}/inventory`, {
    method: "PATCH",
    headers: { ...headers(adminToken), "content-type": "application/json" },
    body: JSON.stringify({ stockQuantity: 0 }),
  });
  assert.equal(clearProductStock.status, 200);
  shopOrderLines.push({
    id: "pending-shop-line",
    catalogItemId: productId,
    orderStatus: "PENDING",
    stockDeducted: false,
    name: "Кабель USB-C",
    unitPriceRub: 900,
  });
  assert.equal((await remove(productId)).status, 409);
  shopOrderLines.pop();

  assert.equal((await remove(productId)).status, 204);
  assert.deepEqual(deletedImageIds, ["catalog-product-image"]);
  assert.deepEqual(shopOrderLines[0], {
    id: "historical-shop-line",
    catalogItemId: null,
    orderStatus: "COMPLETED",
    stockDeducted: true,
    name: "Кабель USB-C",
    unitPriceRub: 900,
  });
});
