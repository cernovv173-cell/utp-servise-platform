import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createShopRouter } from "../src/features/shop/shop.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const adminId = "11111111-1111-4111-8111-111111111111";
const customerId = "22222222-2222-4222-8222-222222222222";
const productId = "33333333-3333-4333-8333-333333333331";
const untrackedProductId = "33333333-3333-4333-8333-333333333332";
const emptyProductId = "33333333-3333-4333-8333-333333333333";
const partId = "33333333-3333-4333-8333-333333333334";
const orderId = "44444444-4444-4444-8444-444444444444";
const secondOrderId = "44444444-4444-4444-8444-444444444445";
const adminToken = "A".repeat(48);
const customerToken = "C".repeat(48);

const createHarness = async (after: (callback: () => void) => void) => {
  const users = [
    {
      id: adminId,
      email: "admin@example.test",
      displayName: "Администратор",
      phoneNumber: "+70000000000",
      role: "ADMIN" as const,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: customerId,
      email: "client@example.test",
      displayName: "Клиент",
      phoneNumber: "+71111111111",
      role: "CUSTOMER" as const,
      active: true,
      mustChangePassword: false,
      token: customerToken,
    },
  ];
  const products = [
    {
      id: productId,
      type: "PRODUCT",
      name: "USB-адаптер",
      unitPriceRub: 250,
      stockQuantity: 5 as number | null,
      active: true,
    },
    {
      id: untrackedProductId,
      type: "PRODUCT",
      name: "Подставка",
      unitPriceRub: 700,
      stockQuantity: null as number | null,
      active: true,
    },
    {
      id: emptyProductId,
      type: "PRODUCT",
      name: "Нет в наличии",
      unitPriceRub: 900,
      stockQuantity: 0 as number | null,
      active: true,
    },
    {
      id: partId,
      type: "SPARE_PART",
      name: "Запчасть",
      unitPriceRub: 1500,
      stockQuantity: 8 as number | null,
      active: true,
    },
  ];
  type TestOrder = Record<string, any>;
  const orders: TestOrder[] = [];
  let itemSequence = 0;
  let orderSequence = 0;
  const client: Record<string, any> = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = users.find(
          (entry) => hashSessionToken(entry.token) === where.tokenHash,
        );
        if (!user) return null;
        const { token: _token, ...authenticatedUser } = user;
        return {
          expiresAt: new Date(Date.now() + 60_000),
          user: authenticatedUser,
        };
      },
    },
    repairCatalogItem: {
      findMany: async ({ where }: { where: Record<string, any> }) =>
        products.filter((product) => {
          if (where.type && product.type !== where.type) return false;
          if (where.active !== undefined && product.active !== where.active)
            return false;
          if (where.id?.in && !where.id.in.includes(product.id)) return false;
          return true;
        }),
      findUnique: async ({ where }: { where: { id: string } }) =>
        products.find((product) => product.id === where.id) ?? null,
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, any>;
        data: { stockQuantity: { decrement?: number; increment?: number } };
      }) => {
        const product = products.find((entry) => entry.id === where.id);
        if (!product) return { count: 0 };
        if (where.type && product.type !== where.type) return { count: 0 };
        if (where.active !== undefined && product.active !== where.active) {
          return { count: 0 };
        }
        const stockFilter = where.stockQuantity as
          { gte?: number; not?: null } | undefined;
        if (stockFilter?.not === null && product.stockQuantity === null) {
          return { count: 0 };
        }
        if (
          stockFilter?.gte !== undefined &&
          (product.stockQuantity === null ||
            product.stockQuantity < stockFilter.gte)
        ) {
          return { count: 0 };
        }
        if (product.stockQuantity === null) return { count: 0 };
        product.stockQuantity +=
          (data.stockQuantity.increment ?? 0) -
          (data.stockQuantity.decrement ?? 0);
        return { count: 1 };
      },
    },
    shopOrder: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const order = {
          id: orderSequence++ === 0 ? orderId : secondOrderId,
          customerId: data.customerId,
          customer: users.find((user) => user.id === data.customerId),
          status: "PENDING",
          customerNote: data.customerNote,
          totalRub: data.totalRub,
          createdAt: new Date(),
          confirmedAt: null,
          completedAt: null,
          cancelledAt: null,
          items: data.items.create.map((item: Record<string, unknown>) => ({
            id: `55555555-5555-4555-8555-${String(++itemSequence).padStart(12, "0")}`,
            stockDeducted: false,
            ...item,
          })),
        };
        orders.push(order);
        return order;
      },
      findMany: async ({ where }: { where?: { customerId?: string } }) =>
        orders
          .filter(
            (order) =>
              !where?.customerId || order.customerId === where.customerId,
          )
          .map((order) => ({ ...order })),
      findUnique: async ({ where }: { where: { id: string } }) =>
        orders.find((order) => order.id === where.id) ?? null,
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const order = orders.find((entry) => entry.id === where.id);
        assert.ok(order);
        Object.assign(order, data);
        return order;
      },
    },
    shopOrderItem: {
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, unknown>;
      }) => {
        const item = orders
          .flatMap((order) => order.items)
          .find((entry) => entry.id === where.id);
        assert.ok(item);
        Object.assign(item, data);
        return item;
      },
    },
    $queryRaw: async () => [],
    $transaction: async (operation: (transaction: unknown) => unknown) =>
      operation(client),
  };

  const app = express();
  app.use(express.json());
  app.use("/api", createShopRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}/api`;
  const request = (
    path: string,
    token?: string,
    body?: unknown,
    method = "GET",
  ) =>
    fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(body ? { "content-type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

  return { products, orders, request };
};

test("public shop lists only active products without exposing exact stock", async (t) => {
  const { request } = await createHarness((callback) => t.after(callback));
  const response = await request("/shop/products");
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    products: Array<{
      id: string;
      availability: string;
      stockQuantity?: number | null;
    }>;
  };
  assert.deepEqual(
    body.products.map(({ id }) => id),
    [productId, untrackedProductId, emptyProductId],
  );
  assert.equal(
    body.products.find(({ id }) => id === productId)?.availability,
    "IN_STOCK",
  );
  assert.equal(
    body.products.find(({ id }) => id === untrackedProductId)?.availability,
    "ADMIN_CONFIRMATION_REQUIRED",
  );
  assert.equal(
    body.products.find(({ id }) => id === emptyProductId)?.availability,
    "OUT_OF_STOCK",
  );
  assert.equal("stockQuantity" in body.products[0]!, false);
});

test("customer order snapshots server prices and waits for admin confirmation", async (t) => {
  const { products, orders, request } = await createHarness((callback) =>
    t.after(callback),
  );
  const response = await request(
    "/shop/orders",
    customerToken,
    {
      items: [{ catalogItemId: productId, quantity: 2 }],
      customerNote: "Свяжитесь после 18:00",
    },
    "POST",
  );
  assert.equal(response.status, 201);
  const body = (await response.json()) as { order: Record<string, any> };
  assert.equal(body.order.status, "PENDING");
  assert.equal(body.order.totalRub, 500);
  assert.equal(body.order.items[0].unitPriceRub, 250);
  assert.equal(body.order.customerNote, "Свяжитесь после 18:00");
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 5);
  assert.equal(orders.length, 1);
});

test("a customer cannot order spare parts, unavailable products, or override prices", async (t) => {
  const { request } = await createHarness((callback) => t.after(callback));
  for (const id of [partId, emptyProductId]) {
    const response = await request(
      "/shop/orders",
      customerToken,
      { items: [{ catalogItemId: id, quantity: 1 }] },
      "POST",
    );
    assert.equal(response.status, 409);
  }
  const priceOverride = await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: productId, quantity: 1, unitPriceRub: 1 }] },
    "POST",
  );
  assert.equal(priceOverride.status, 400);
});

test("admin confirmation reserves tracked stock, cancellation restores it, and completion is terminal", async (t) => {
  const { products, request } = await createHarness((callback) =>
    t.after(callback),
  );
  await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: productId, quantity: 2 }] },
    "POST",
  );
  const confirmed = await request(
    `/admin/shop/orders/${orderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmed.status, 200);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 3);

  const cancelled = await request(
    `/admin/shop/orders/${orderId}/status`,
    adminToken,
    { status: "CANCELLED" },
    "PATCH",
  );
  assert.equal(cancelled.status, 200);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 5);

  await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: productId, quantity: 2 }] },
    "POST",
  );
  const completed = await request(
    `/admin/shop/orders/${secondOrderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(completed.status, 200);
  const finished = await request(
    `/admin/shop/orders/${secondOrderId}/status`,
    adminToken,
    { status: "COMPLETED" },
    "PATCH",
  );
  assert.equal(finished.status, 200);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 3);
  const cannotCancelCompleted = await request(
    `/admin/shop/orders/${secondOrderId}/status`,
    adminToken,
    { status: "CANCELLED" },
    "PATCH",
  );
  assert.equal(cannotCancelCompleted.status, 409);
});

test("insufficient stock leaves an order pending and only customers see their own order list", async (t) => {
  const { products, request } = await createHarness((callback) =>
    t.after(callback),
  );
  await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: productId, quantity: 6 }] },
    "POST",
  );
  const confirmation = await request(
    `/admin/shop/orders/${orderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmation.status, 409);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 5);
  const customerOrders = await request("/shop/orders", customerToken);
  assert.equal(customerOrders.status, 200);
  const adminOrders = await request("/shop/orders", adminToken);
  assert.equal(adminOrders.status, 403);
});
