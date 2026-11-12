import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";

import { hashSessionToken } from "../../src/features/auth/auth.middleware.js";
import type { PushNotification } from "../../src/features/notifications/push-notifications.js";
import { createShopRouter } from "../../src/features/shop/shop.routes.js";
import type { DatabaseClient } from "../../src/lib/database/database.js";
import { errorHandler } from "../../src/lib/http/error-handler.js";

export const shopTestIds = {
  adminId: "11111111-1111-4111-8111-111111111111",
  assistantId: "11111111-1111-4111-8111-111111111112",
  customerId: "22222222-2222-4222-8222-222222222222",
  productId: "33333333-3333-4333-8333-333333333331",
  untrackedProductId: "33333333-3333-4333-8333-333333333332",
  emptyProductId: "33333333-3333-4333-8333-333333333333",
  partId: "33333333-3333-4333-8333-333333333334",
  craftItemId: "33333333-3333-4333-8333-333333333335",
  emptyCraftItemId: "33333333-3333-4333-8333-333333333336",
  draftCraftItemId: "33333333-3333-4333-8333-333333333337",
  orderId: "44444444-4444-4444-8444-444444444444",
  secondOrderId: "44444444-4444-4444-8444-444444444445",
} as const;

export const adminToken = "A".repeat(48);
export const customerToken = "C".repeat(48);

export const createShopRoutesHarness = async (
  after: (callback: () => void) => void,
) => {
  const users = [
    {
      id: shopTestIds.adminId,
      email: "admin@example.test",
      displayName: "Администратор",
      phoneNumber: "+70000000000",
      role: "ADMIN" as const,
      isAdminAssistant: false,
      active: true,
      mustChangePassword: false,
      token: adminToken,
    },
    {
      id: shopTestIds.assistantId,
      email: "assistant@example.test",
      displayName: "Помощник администратора",
      phoneNumber: "+72222222222",
      role: "ADMIN" as const,
      isAdminAssistant: true,
      active: true,
      mustChangePassword: false,
      token: "H".repeat(48),
    },
    {
      id: shopTestIds.customerId,
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
      id: shopTestIds.productId,
      type: "PRODUCT",
      name: "USB-адаптер",
      unitPriceRub: 250,
      stockQuantity: 5 as number | null,
      active: true,
    },
    {
      id: shopTestIds.untrackedProductId,
      type: "PRODUCT",
      name: "Подставка",
      unitPriceRub: 700,
      stockQuantity: null as number | null,
      active: true,
    },
    {
      id: shopTestIds.emptyProductId,
      type: "PRODUCT",
      name: "Нет в наличии",
      unitPriceRub: 900,
      stockQuantity: 0 as number | null,
      active: true,
    },
    {
      id: shopTestIds.partId,
      type: "SPARE_PART",
      name: "Запчасть",
      unitPriceRub: 1500,
      stockQuantity: 8 as number | null,
      active: true,
    },
  ];
  const craftItems = [
    {
      id: shopTestIds.craftItemId,
      title: "Керамическая чашка",
      priceRub: 400,
      stockQuantity: 3,
      isPublished: true,
    },
    {
      id: shopTestIds.emptyCraftItemId,
      title: "Связанный шарф",
      priceRub: 1200,
      stockQuantity: 0,
      isPublished: true,
    },
    {
      id: shopTestIds.draftCraftItemId,
      title: "Черновик изделия",
      priceRub: 900,
      stockQuantity: 1,
      isPublished: false,
    },
  ];
  type TestOrder = Record<string, any>;
  const orders: TestOrder[] = [];
  const sentNotifications: Array<{
    recipientIds: string[];
    notification: PushNotification;
  }> = [];
  const sendNotification = async (
    _database: DatabaseClient,
    recipientIds: readonly string[],
    notification: PushNotification,
  ): Promise<boolean> => {
    sentNotifications.push({ recipientIds: [...recipientIds], notification });
    return true;
  };
  let itemSequence = 0;
  let orderSequence = 0;
  const client: Record<string, any> = {
    user: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        users
          .filter(
            (user) =>
              user.role === where.role &&
              (where.active === undefined || user.active === where.active),
          )
          .map(({ id }) => ({ id })),
    },
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
    craftItem: {
      findMany: async ({ where }: { where: Record<string, any> }) =>
        craftItems.filter((item) => {
          if (
            where.isPublished !== undefined &&
            item.isPublished !== where.isPublished
          )
            return false;
          if (where.id?.in && !where.id.in.includes(item.id)) return false;
          return true;
        }),
      updateMany: async ({
        where,
        data,
      }: {
        where: Record<string, any>;
        data: { stockQuantity: { decrement?: number; increment?: number } };
      }) => {
        const item = craftItems.find((entry) => entry.id === where.id);
        if (!item) return { count: 0 };
        if (
          where.isPublished !== undefined &&
          item.isPublished !== where.isPublished
        )
          return { count: 0 };
        if (
          where.stockQuantity?.gte !== undefined &&
          item.stockQuantity < where.stockQuantity.gte
        )
          return { count: 0 };
        item.stockQuantity +=
          (data.stockQuantity.increment ?? 0) -
          (data.stockQuantity.decrement ?? 0);
        return { count: 1 };
      },
    },
    shopOrder: {
      create: async ({ data }: { data: Record<string, any> }) => {
        const order = {
          id:
            orderSequence++ === 0
              ? shopTestIds.orderId
              : shopTestIds.secondOrderId,
          customerId: data.customerId,
          customer: users.find((user) => user.id === data.customerId),
          status: "PENDING",
          customerNote: data.customerNote,
          deliveryMethod: data.deliveryMethod ?? "PICKUP",
          deliveryArea: data.deliveryArea ?? null,
          deliveryCity: data.deliveryCity ?? null,
          deliveryAddress: data.deliveryAddress ?? null,
          deliveryRequestNote: data.deliveryRequestNote ?? null,
          deliveryFeeRub: null,
          deliveryWindow: null,
          deliveryOfferAcceptedAt: null,
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
  app.use(
    "/api",
    createShopRouter(
      client as unknown as DatabaseClient,
      undefined,
      sendNotification,
    ),
  );
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

  return { products, craftItems, orders, sentNotifications, request };
};
