import assert from "node:assert/strict";
import test from "node:test";

import {
  createShopRoutesHarness,
  customerToken,
  shopTestIds,
} from "./helpers/shop-routes-harness.js";

const {
  productId,
  untrackedProductId,
  emptyProductId,
  partId,
  orderId,
  secondOrderId,
} = shopTestIds;

test("public shop lists only active products without exposing exact stock", async (t) => {
  const { request } = await createShopRoutesHarness((callback) =>
    t.after(callback),
  );
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
  const { products, orders, request } = await createShopRoutesHarness(
    (callback) => t.after(callback),
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
  assert.equal(body.order.deliveryMethod, "PICKUP");
  assert.equal(body.order.totalRub, 500);
  assert.equal(body.order.items[0].unitPriceRub, 250);
  assert.equal(body.order.customerNote, "Свяжитесь после 18:00");
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 5);
  assert.equal(orders.length, 1);
});

test("a customer cannot order spare parts, unavailable products, or override prices", async (t) => {
  const { request } = await createShopRoutesHarness((callback) =>
    t.after(callback),
  );
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
  const { products, request } = await createShopRoutesHarness((callback) =>
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
    "A".repeat(48),
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmed.status, 200);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 3);

  const cancelled = await request(
    `/admin/shop/orders/${orderId}/status`,
    "A".repeat(48),
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
    "A".repeat(48),
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(completed.status, 200);
  const finished = await request(
    `/admin/shop/orders/${secondOrderId}/status`,
    "A".repeat(48),
    { status: "COMPLETED" },
    "PATCH",
  );
  assert.equal(finished.status, 200);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 3);
  const cannotCancelCompleted = await request(
    `/admin/shop/orders/${secondOrderId}/status`,
    "A".repeat(48),
    { status: "CANCELLED" },
    "PATCH",
  );
  assert.equal(cannotCancelCompleted.status, 409);
});

test("insufficient stock leaves an order pending and only customers see their own order list", async (t) => {
  const { products, request } = await createShopRoutesHarness((callback) =>
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
    "A".repeat(48),
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmation.status, 409);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 5);
  const customerOrders = await request("/shop/orders", customerToken);
  assert.equal(customerOrders.status, 200);
  const adminOrders = await request("/shop/orders", "A".repeat(48));
  assert.equal(adminOrders.status, 403);
});
