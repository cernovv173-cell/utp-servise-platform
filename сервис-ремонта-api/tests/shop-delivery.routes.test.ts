import assert from "node:assert/strict";
import test from "node:test";

import {
  adminToken,
  createShopRoutesHarness,
  customerToken,
  shopTestIds,
} from "./helpers/shop-routes-harness.js";

test("courier orders require an approved pilot city and a delivery address", async (t) => {
  const { products, orders, request } = await createShopRoutesHarness(
    (callback) => t.after(callback),
  );
  const response = await request(
    "/shop/orders",
    customerToken,
    {
      items: [{ catalogItemId: shopTestIds.productId, quantity: 1 }],
      deliveryMethod: "COURIER",
      deliveryArea: "MOSCOW_REGION",
      deliveryCity: "Мытищи",
      deliveryAddress: "Мытищи, улица Примерная, дом 4",
      deliveryRequestNote: "Домофон 25",
    },
    "POST",
  );
  assert.equal(response.status, 201);
  const body = (await response.json()) as { order: Record<string, any> };
  assert.equal(body.order.deliveryMethod, "COURIER");
  assert.equal(body.order.deliveryArea, "MOSCOW_REGION");
  assert.equal(body.order.deliveryCity, "Мытищи");
  assert.equal(body.order.deliveryAddress, "Мытищи, улица Примерная, дом 4");
  assert.equal(body.order.deliveryRequestNote, "Домофон 25");
  assert.equal(body.order.totalRub, 250);
  assert.equal(
    products.find(({ id }) => id === shopTestIds.productId)?.stockQuantity,
    5,
  );
  assert.equal(orders.length, 1);

  const invalidCity = await request(
    "/shop/orders",
    customerToken,
    {
      items: [{ catalogItemId: shopTestIds.productId, quantity: 1 }],
      deliveryMethod: "COURIER",
      deliveryArea: "TVER",
      deliveryCity: "Тверь",
      deliveryAddress: "Москва, улица Примерная, дом 4",
    },
    "POST",
  );
  assert.equal(invalidCity.status, 400);
  const missingAddress = await request(
    "/shop/orders",
    customerToken,
    {
      items: [{ catalogItemId: shopTestIds.productId, quantity: 1 }],
      deliveryMethod: "COURIER",
      deliveryArea: "MOSCOW",
      deliveryCity: "Москва",
    },
    "POST",
  );
  assert.equal(missingAddress.status, 400);
});

test("customer approval is required before admin can reserve courier-order stock", async (t) => {
  const { products, request, sentNotifications } =
    await createShopRoutesHarness((callback) => t.after(callback));
  await request(
    "/shop/orders",
    customerToken,
    {
      items: [{ catalogItemId: shopTestIds.productId, quantity: 2 }],
      deliveryMethod: "COURIER",
      deliveryArea: "MOSCOW_REGION",
      deliveryCity: "Королёв",
      deliveryAddress: "Королёв, улица Примерная, дом 8, квартира 12",
    },
    "POST",
  );

  const prematureConfirmation = await request(
    `/admin/shop/orders/${shopTestIds.orderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(prematureConfirmation.status, 409);
  assert.equal(
    products.find(({ id }) => id === shopTestIds.productId)?.stockQuantity,
    5,
  );

  const offer = await request(
    `/admin/shop/orders/${shopTestIds.orderId}/delivery-offer`,
    adminToken,
    { deliveryFeeRub: 350, deliveryWindow: "Завтра, 14:00–18:00" },
    "PATCH",
  );
  assert.equal(offer.status, 200);
  const offerBody = (await offer.json()) as { order: Record<string, any> };
  assert.equal(offerBody.order.deliveryFeeRub, 350);
  assert.equal(offerBody.order.deliveryWindow, "Завтра, 14:00–18:00");
  assert.equal(offerBody.order.deliveryOfferAcceptedAt, null);
  assert.equal(
    sentNotifications[1]?.notification.data.type,
    "shop_order_updated",
  );
  assert.deepEqual(sentNotifications[1]?.recipientIds, [
    shopTestIds.assistantId,
  ]);

  const adminCannotRespond = await request(
    `/shop/orders/${shopTestIds.orderId}/delivery-response`,
    adminToken,
    { accept: true },
    "PATCH",
  );
  assert.equal(adminCannotRespond.status, 403);

  const accepted = await request(
    `/shop/orders/${shopTestIds.orderId}/delivery-response`,
    customerToken,
    { accept: true },
    "PATCH",
  );
  assert.equal(accepted.status, 200);
  const acceptedBody = (await accepted.json()) as {
    order: Record<string, any>;
  };
  assert.ok(acceptedBody.order.deliveryOfferAcceptedAt);
  const deliveryResponseNotification = sentNotifications.find(
    ({ notification }) => notification.data.type === "shop_delivery_response",
  );
  assert.equal(
    deliveryResponseNotification?.notification.data.orderId,
    shopTestIds.orderId,
  );
  assert.deepEqual(deliveryResponseNotification?.recipientIds, [
    shopTestIds.adminId,
    shopTestIds.assistantId,
  ]);
  assert.equal(
    products.find(({ id }) => id === shopTestIds.productId)?.stockQuantity,
    5,
  );

  const revisedOffer = await request(
    `/admin/shop/orders/${shopTestIds.orderId}/delivery-offer`,
    adminToken,
    { deliveryFeeRub: 400, deliveryWindow: "Послезавтра, после 12:00" },
    "PATCH",
  );
  assert.equal(revisedOffer.status, 200);
  const revisedBody = (await revisedOffer.json()) as {
    order: Record<string, any>;
  };
  assert.equal(revisedBody.order.deliveryOfferAcceptedAt, null);
  const staleAgreement = await request(
    `/admin/shop/orders/${shopTestIds.orderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(staleAgreement.status, 409);

  const reaccepted = await request(
    `/shop/orders/${shopTestIds.orderId}/delivery-response`,
    customerToken,
    { accept: true },
    "PATCH",
  );
  assert.equal(reaccepted.status, 200);
  const confirmed = await request(
    `/admin/shop/orders/${shopTestIds.orderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmed.status, 200);
  assert.equal(
    products.find(({ id }) => id === shopTestIds.productId)?.stockQuantity,
    3,
  );
});

test("customer declining a delivery offer cancels it without reserving stock", async (t) => {
  const { products, request, sentNotifications } =
    await createShopRoutesHarness((callback) => t.after(callback));
  await request(
    "/shop/orders",
    customerToken,
    {
      items: [{ catalogItemId: shopTestIds.productId, quantity: 1 }],
      deliveryMethod: "COURIER",
      deliveryArea: "MOSCOW_REGION",
      deliveryCity: "Пушкино",
      deliveryAddress: "Пушкино, улица Примерная, дом 3",
    },
    "POST",
  );
  await request(
    `/admin/shop/orders/${shopTestIds.orderId}/delivery-offer`,
    adminToken,
    { deliveryFeeRub: 0, deliveryWindow: "По согласованию" },
    "PATCH",
  );
  const declined = await request(
    `/shop/orders/${shopTestIds.orderId}/delivery-response`,
    customerToken,
    { accept: false },
    "PATCH",
  );
  assert.equal(declined.status, 200);
  const declinedBody = (await declined.json()) as {
    order: Record<string, any>;
  };
  assert.equal(declinedBody.order.status, "CANCELLED");
  assert.ok(
    sentNotifications.some(
      ({ notification }) => notification.data.type === "shop_delivery_response",
    ),
  );
  assert.equal(
    products.find(({ id }) => id === shopTestIds.productId)?.stockQuantity,
    5,
  );
  const confirmation = await request(
    `/admin/shop/orders/${shopTestIds.orderId}/status`,
    adminToken,
    { status: "CONFIRMED" },
    "PATCH",
  );
  assert.equal(confirmation.status, 409);
});
