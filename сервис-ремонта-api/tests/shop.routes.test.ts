import assert from "node:assert/strict";
import test from "node:test";

import {
  adminToken,
  createShopRoutesHarness,
  customerToken,
  otherCustomerToken,
  shopTestIds,
} from "./helpers/shop-routes-harness.js";

const {
  productId,
  untrackedProductId,
  emptyProductId,
  partId,
  craftItemId,
  emptyCraftItemId,
  draftCraftItemId,
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

test("public shop handmade catalog exposes only published craft items", async (t) => {
  const { request } = await createShopRoutesHarness((callback) =>
    t.after(callback),
  );
  const response = await request("/shop/craft-items");
  assert.equal(response.status, 200);
  const body = (await response.json()) as {
    items: Array<{ id: string; title: string; stockQuantity: number }>;
  };
  assert.deepEqual(
    body.items.map(({ id }) => id),
    [craftItemId, emptyCraftItemId],
  );
  assert.equal(
    body.items.some(({ id }) => id === draftCraftItemId),
    false,
  );
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

test("ready handmade goods use the store cart and stock is reserved and restored", async (t) => {
  const { craftItems, request, sentNotifications } =
    await createShopRoutesHarness((callback) => t.after(callback));
  const created = await request(
    "/shop/orders",
    customerToken,
    {
      items: [
        { catalogItemId: productId, quantity: 1 },
        { craftItemId, quantity: 2 },
      ],
    },
    "POST",
  );
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { order: Record<string, any> };
  assert.equal(createdBody.order.totalRub, 1050);
  assert.equal(sentNotifications.length, 1);
  assert.deepEqual(sentNotifications[0]?.recipientIds, [
    shopTestIds.adminId,
    shopTestIds.assistantId,
  ]);
  assert.equal(
    sentNotifications[0]?.notification.data.type,
    "shop_order_created",
  );
  assert.equal(sentNotifications[0]?.notification.data.orderId, orderId);
  assert.ok(
    createdBody.order.items.some(
      (item: Record<string, any>) => item.craftItemId === craftItemId,
    ),
  );
  assert.equal(
    craftItems.find((item) => item.id === craftItemId)?.stockQuantity,
    3,
  );

  const confirmed = await request(
    `/admin/shop/orders/${orderId}/status`,
    "A".repeat(48),
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmed.status, 200);
  assert.equal(
    craftItems.find((item) => item.id === craftItemId)?.stockQuantity,
    1,
  );

  const cancelled = await request(
    `/admin/shop/orders/${orderId}/status`,
    "A".repeat(48),
    { status: "CANCELLED" },
    "PATCH",
  );
  assert.equal(cancelled.status, 200);
  assert.equal(
    craftItems.find((item) => item.id === craftItemId)?.stockQuantity,
    3,
  );

  const unavailable = await request(
    "/shop/orders",
    customerToken,
    { items: [{ craftItemId: emptyCraftItemId, quantity: 1 }] },
    "POST",
  );
  assert.equal(unavailable.status, 409);
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
  const { products, request, sentNotifications } =
    await createShopRoutesHarness((callback) => t.after(callback));
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
  assert.equal(
    sentNotifications[1]?.notification.data.type,
    "shop_order_updated",
  );
  assert.deepEqual(sentNotifications[1]?.recipientIds, [
    shopTestIds.assistantId,
  ]);
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

test("checkout rejects quantities above tracked product and craft stock before creating an order", async (t) => {
  const { products, craftItems, orders, request } =
    await createShopRoutesHarness((callback) => t.after(callback));
  const productResponse = await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: productId, quantity: 6 }] },
    "POST",
  );
  assert.equal(productResponse.status, 409);
  const productError = (await productResponse.json()) as {
    error: { code: string; message: string };
  };
  assert.equal(productError.error.code, "SHOP_STOCK_INSUFFICIENT");
  assert.match(productError.error.message, /уменьшите количество/iu);

  const craftResponse = await request(
    "/shop/orders",
    customerToken,
    { items: [{ craftItemId, quantity: 4 }] },
    "POST",
  );
  assert.equal(craftResponse.status, 409);

  const mixedCartResponse = await request(
    "/shop/orders",
    customerToken,
    {
      items: [
        { catalogItemId: productId, quantity: 1 },
        { craftItemId, quantity: 4 },
      ],
    },
    "POST",
  );
  assert.equal(mixedCartResponse.status, 409);
  assert.equal(orders.length, 0);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 5);
  assert.equal(
    craftItems.find(({ id }) => id === craftItemId)?.stockQuantity,
    3,
  );

  const untrackedProductResponse = await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: untrackedProductId, quantity: 2 }] },
    "POST",
  );
  assert.equal(untrackedProductResponse.status, 201);
  assert.equal(orders.length, 1);
});

test("customers can cancel only their own pending pickup orders without changing stock", async (t) => {
  const { products, orders, request, sentNotifications } =
    await createShopRoutesHarness((callback) => t.after(callback));
  await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: productId, quantity: 2 }] },
    "POST",
  );

  const otherCustomerCancellation = await request(
    `/shop/orders/${orderId}/cancel`,
    otherCustomerToken,
    undefined,
    "PATCH",
  );
  assert.equal(otherCustomerCancellation.status, 404);

  const cancellation = await request(
    `/shop/orders/${orderId}/cancel`,
    customerToken,
    undefined,
    "PATCH",
  );
  assert.equal(cancellation.status, 200);
  const body = (await cancellation.json()) as { order: Record<string, any> };
  assert.equal(body.order.status, "CANCELLED");
  assert.ok(body.order.cancelledAt);
  assert.equal(orders[0]?.status, "CANCELLED");
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 5);
  assert.equal(
    sentNotifications[1]?.notification.data.type,
    "shop_order_updated",
  );
  assert.equal(sentNotifications[1]?.notification.data.orderId, orderId);

  const repeatedCancellation = await request(
    `/shop/orders/${orderId}/cancel`,
    customerToken,
    undefined,
    "PATCH",
  );
  assert.equal(repeatedCancellation.status, 200);
  const repeatedBody = (await repeatedCancellation.json()) as {
    order: Record<string, any>;
  };
  assert.equal(repeatedBody.order.status, "CANCELLED");
  assert.equal(sentNotifications.length, 2);

  const customerOrders = await request("/shop/orders", customerToken);
  assert.equal(customerOrders.status, 200);
  const customerOrdersBody = (await customerOrders.json()) as {
    orders: Array<{ status: string }>;
  };
  assert.equal(customerOrdersBody.orders[0]?.status, "CANCELLED");
  const adminOrders = await request("/shop/orders", "A".repeat(48));
  assert.equal(adminOrders.status, 403);
});

test("customers cannot cancel confirmed pickup or pending courier orders through pickup cancellation", async (t) => {
  const { products, orders, request } = await createShopRoutesHarness(
    (callback) => t.after(callback),
  );
  await request(
    "/shop/orders",
    customerToken,
    { items: [{ catalogItemId: productId, quantity: 1 }] },
    "POST",
  );
  const confirmed = await request(
    `/admin/shop/orders/${orderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmed.status, 200);
  const confirmedCancellation = await request(
    `/shop/orders/${orderId}/cancel`,
    customerToken,
    undefined,
    "PATCH",
  );
  assert.equal(confirmedCancellation.status, 409);
  assert.equal(products.find(({ id }) => id === productId)?.stockQuantity, 4);

  const courierOrder = await request(
    "/shop/orders",
    customerToken,
    {
      items: [{ catalogItemId: productId, quantity: 1 }],
      deliveryMethod: "COURIER",
      deliveryArea: "MOSCOW_REGION",
      deliveryCity: "Пушкино",
      deliveryAddress: "Пушкино, улица Примерная, дом 3",
    },
    "POST",
  );
  assert.equal(courierOrder.status, 201);
  const courierCancellation = await request(
    `/shop/orders/${secondOrderId}/cancel`,
    customerToken,
    undefined,
    "PATCH",
  );
  assert.equal(courierCancellation.status, 409);
  assert.equal(orders[1]?.status, "PENDING");
});
