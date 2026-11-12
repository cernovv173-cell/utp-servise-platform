import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import { sendPushNotification } from "../notifications/push-notifications.js";
import { createShopDeliveryRouter } from "./shop-delivery.routes.js";
import { sendShopNotificationToAdministrators } from "./shop-notifications.js";

const orderItemsBody = z
  .array(
    z
      .object({
        catalogItemId: z.string().uuid().optional(),
        craftItemId: z.string().uuid().optional(),
        quantity: z.number().int().min(1).max(100),
      })
      .strict()
      .refine(
        (item) => Boolean(item.catalogItemId) !== Boolean(item.craftItemId),
        "Укажите один товар для заказа.",
      ),
  )
  .min(1)
  .max(50)
  .refine(
    (items) =>
      new Set(items.map((item) => item.catalogItemId ?? item.craftItemId))
        .size === items.length,
    "Каждый товар можно добавить в заказ только один раз.",
  );

const deliveryAreas = ["MOSCOW", "MOSCOW_REGION"] as const;

const createOrderBody = z
  .object({
    items: orderItemsBody,
    customerNote: z.string().trim().max(1000).optional().nullable(),
    deliveryMethod: z.enum(["PICKUP", "COURIER"]).default("PICKUP"),
    deliveryArea: z.enum(deliveryAreas).optional(),
    deliveryCity: z.string().trim().min(2).max(120).optional(),
    deliveryAddress: z.string().trim().min(1).max(500).optional(),
    deliveryRequestNote: z.string().trim().max(500).optional().nullable(),
  })
  .strict()
  .superRefine((order, context) => {
    if (order.deliveryMethod === "COURIER") {
      if (!order.deliveryArea) {
        context.addIssue({
          code: "custom",
          path: ["deliveryArea"],
          message: "Выберите регион доставки.",
        });
      }
      if (!order.deliveryCity) {
        context.addIssue({
          code: "custom",
          path: ["deliveryCity"],
          message: "Укажите населённый пункт.",
        });
      }
      if (!order.deliveryAddress) {
        context.addIssue({
          code: "custom",
          path: ["deliveryAddress"],
          message: "Укажите адрес доставки.",
        });
      }
    } else if (
      order.deliveryArea ||
      order.deliveryCity ||
      order.deliveryAddress
    ) {
      context.addIssue({
        code: "custom",
        path: ["deliveryMethod"],
        message:
          "Адрес доставки можно указывать только для курьерского заказа.",
      });
    }
  });

const orderIdParams = z.object({ orderId: z.string().uuid() });
const craftImageParams = z.object({
  craftItemId: z.string().uuid(),
  objectId: z.string().trim().min(1).max(255),
});
const orderStatusBody = z
  .object({ status: z.enum(["CONFIRMED", "COMPLETED", "CANCELLED"]) })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const orderInclude = {
  items: { orderBy: { name: "asc" as const } },
};

const adminOrderInclude = {
  ...orderInclude,
  customer: {
    select: { id: true, displayName: true, email: true, phoneNumber: true },
  },
};

const unavailableProduct = () =>
  new HttpError(
    409,
    "SHOP_PRODUCT_UNAVAILABLE",
    "Один из товаров больше недоступен. Обновите корзину.",
  );

const insufficientShopStock = (name: string) =>
  new HttpError(
    409,
    "SHOP_STOCK_INSUFFICIENT",
    `Недостаточно «${name}» в наличии. Уменьшите количество в корзине и попробуйте ещё раз.`,
  );

export const createShopRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
  sendNotification: typeof sendPushNotification = sendPushNotification,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  router.use(createShopDeliveryRouter(database, sendNotification));

  router.get("/shop/products", async (_request, response) => {
    const products = await database.repairCatalogItem.findMany({
      where: { type: "PRODUCT", active: true },
      select: {
        id: true,
        name: true,
        description: true,
        imageObjectIds: true,
        unitPriceRub: true,
        stockQuantity: true,
      },
      orderBy: { name: "asc" },
      take: 250,
    });
    response.json({
      products: products.map(({ stockQuantity, ...product }) => ({
        ...product,
        availability:
          stockQuantity === null
            ? "ADMIN_CONFIRMATION_REQUIRED"
            : stockQuantity > 0
              ? "IN_STOCK"
              : "OUT_OF_STOCK",
      })),
    });
  });

  router.get("/shop/craft-items", async (_request, response) => {
    const items = await database.craftItem.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        title: true,
        description: true,
        priceRub: true,
        imageObjectId: true,
        stockQuantity: true,
        customOrderAvailable: true,
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    response.json({ items });
  });

  router.get(
    "/shop/craft-items/:craftItemId/images/:objectId",
    validateRequest({ params: craftImageParams }),
    async (_request, response) => {
      const { craftItemId, objectId } =
        paramsOf<z.infer<typeof craftImageParams>>(response);
      const item = await database.craftItem.findFirst({
        where: { id: craftItemId, isPublished: true, imageObjectId: objectId },
        select: { id: true },
      });
      if (!item) {
        throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
      }
      const image = await storage.download(objectId);
      response
        .setHeader("Content-Type", image.contentType)
        .setHeader("Cache-Control", "public, max-age=300")
        .setHeader("X-Content-Type-Options", "nosniff")
        .send(image.bytes);
    },
  );

  router.get(
    "/shop/products/:catalogItemId/images/:objectId",
    validateRequest({
      params: z.object({
        catalogItemId: z.string().uuid(),
        objectId: z.string().trim().min(1).max(255),
      }),
    }),
    async (_request, response) => {
      const { catalogItemId, objectId } = paramsOf<{
        catalogItemId: string;
        objectId: string;
      }>(response);
      const product = await database.repairCatalogItem.findFirst({
        where: {
          id: catalogItemId,
          type: "PRODUCT",
          active: true,
          imageObjectIds: { has: objectId },
        },
        select: { id: true },
      });
      if (!product) {
        throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
      }
      const image = await storage.download(objectId);
      response
        .setHeader("Content-Type", image.contentType)
        .setHeader("Cache-Control", "public, max-age=300")
        .setHeader("X-Content-Type-Options", "nosniff")
        .send(image.bytes);
    },
  );

  router.post(
    "/shop/orders",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: createOrderBody }),
    async (_request, response) => {
      const customer = getAuthenticatedUser(response);
      const {
        items,
        customerNote,
        deliveryMethod,
        deliveryArea,
        deliveryCity,
        deliveryAddress,
        deliveryRequestNote,
      } = bodyOf<z.infer<typeof createOrderBody>>(response);

      const order = await database.$transaction(async (transaction) => {
        const requestedCatalogIds = items.flatMap((item) =>
          item.catalogItemId ? [item.catalogItemId] : [],
        );
        const requestedCraftIds = items.flatMap((item) =>
          item.craftItemId ? [item.craftItemId] : [],
        );
        const [products, crafts] = await Promise.all([
          transaction.repairCatalogItem.findMany({
            where: {
              id: { in: requestedCatalogIds },
              type: "PRODUCT",
              active: true,
            },
            select: {
              id: true,
              name: true,
              unitPriceRub: true,
              stockQuantity: true,
            },
          }),
          transaction.craftItem.findMany({
            where: { id: { in: requestedCraftIds }, isPublished: true },
            select: {
              id: true,
              title: true,
              priceRub: true,
              stockQuantity: true,
            },
          }),
        ]);
        if (
          products.length !== requestedCatalogIds.length ||
          crafts.length !== requestedCraftIds.length
        ) {
          throw unavailableProduct();
        }

        const productById = new Map(
          products.map((product) => [product.id, product]),
        );
        const craftById = new Map(crafts.map((craft) => [craft.id, craft]));
        const orderItems = items.map((item) => {
          if (item.catalogItemId) {
            const product = productById.get(item.catalogItemId);
            if (!product) throw unavailableProduct();
            if (
              product.stockQuantity !== null &&
              product.stockQuantity < item.quantity
            ) {
              throw insufficientShopStock(product.name);
            }
            return {
              catalogItemId: product.id,
              craftItemId: null,
              name: product.name,
              quantity: item.quantity,
              unitPriceRub: product.unitPriceRub,
            };
          }
          const craft = item.craftItemId
            ? craftById.get(item.craftItemId)
            : undefined;
          if (!craft) throw unavailableProduct();
          if (craft.stockQuantity < item.quantity) {
            throw insufficientShopStock(craft.title);
          }
          return {
            catalogItemId: null,
            craftItemId: craft.id,
            name: craft.title,
            quantity: item.quantity,
            unitPriceRub: craft.priceRub,
          };
        });
        const totalRub = orderItems.reduce(
          (sum, item) => sum + item.quantity * item.unitPriceRub,
          0,
        );
        if (!Number.isSafeInteger(totalRub) || totalRub > 2_147_483_647) {
          throw new HttpError(
            400,
            "SHOP_ORDER_TOTAL_LIMIT_EXCEEDED",
            "Сумма заказа превышает допустимое значение.",
          );
        }

        return transaction.shopOrder.create({
          data: {
            customerId: customer.id,
            customerNote: customerNote?.trim() || null,
            deliveryMethod,
            deliveryArea: deliveryArea ?? null,
            deliveryCity: deliveryCity ?? null,
            deliveryAddress: deliveryAddress?.trim() || null,
            deliveryRequestNote: deliveryRequestNote?.trim() || null,
            totalRub,
            items: { create: orderItems },
          },
          include: orderInclude,
        });
      });

      await sendShopNotificationToAdministrators(
        database,
        {
          title: "Новый заказ в магазине",
          body: "Поступил новый заказ. Откройте приложение, чтобы посмотреть его детали.",
          data: { type: "shop_order_created", orderId: order.id },
        },
        sendNotification,
      );

      response.status(201).json({ order });
    },
  );

  router.get(
    "/shop/orders",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const customer = getAuthenticatedUser(response);
      const orders = await database.shopOrder.findMany({
        where: { customerId: customer.id },
        include: orderInclude,
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      response.json({ orders });
    },
  );

  router.patch(
    "/shop/orders/:orderId/cancel",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const customer = getAuthenticatedUser(response);
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { order, shouldNotify } = await database.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`
          SELECT "id" FROM "shop_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
          const current = await transaction.shopOrder.findUnique({
            where: { id: orderId },
            include: orderInclude,
          });
          if (!current || current.customerId !== customer.id) {
            throw new HttpError(
              404,
              "SHOP_ORDER_NOT_FOUND",
              "Заказ магазина не найден.",
            );
          }
          if (current.deliveryMethod !== "PICKUP") {
            throw new HttpError(
              409,
              "SHOP_ORDER_NOT_CANCELLABLE",
              "Самостоятельно отменить можно только ожидающий заказ на самовывоз.",
            );
          }
          if (current.status === "CANCELLED") {
            return { order: current, shouldNotify: false };
          }
          if (current.status !== "PENDING") {
            throw new HttpError(
              409,
              "SHOP_ORDER_NOT_CANCELLABLE",
              "Самостоятельно отменить можно только ожидающий заказ на самовывоз.",
            );
          }
          return {
            order: await transaction.shopOrder.update({
              where: { id: orderId },
              data: { status: "CANCELLED", cancelledAt: new Date() },
              include: orderInclude,
            }),
            shouldNotify: true,
          };
        },
      );

      if (shouldNotify) {
        await sendShopNotificationToAdministrators(
          database,
          {
            title: "Самовывоз в магазине отменён",
            body: "Клиент отменил ожидающий заказ на самовывоз.",
            data: { type: "shop_order_updated", orderId: order.id },
          },
          sendNotification,
        );
      }
      response.json({ order });
    },
  );

  router.get(
    "/admin/shop/orders",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const orders = await database.shopOrder.findMany({
        include: adminOrderInclude,
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      response.json({ orders });
    },
  );

  router.patch(
    "/admin/shop/orders/:orderId/status",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: orderStatusBody }),
    async (_request, response) => {
      const actor = getAuthenticatedUser(response);
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { status } = bodyOf<z.infer<typeof orderStatusBody>>(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "shop_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const current = await transaction.shopOrder.findUnique({
          where: { id: orderId },
          include: { items: true },
        });
        if (!current) {
          throw new HttpError(
            404,
            "SHOP_ORDER_NOT_FOUND",
            "Заказ магазина не найден.",
          );
        }

        const now = new Date();
        if (status === "CONFIRMED") {
          if (current.status !== "PENDING") {
            throw new HttpError(
              409,
              "SHOP_ORDER_STATUS_CONFLICT",
              "Подтвердить можно только ожидающий заказ.",
            );
          }
          if (
            current.deliveryMethod === "COURIER" &&
            !current.deliveryOfferAcceptedAt
          ) {
            throw new HttpError(
              409,
              "SHOP_DELIVERY_NOT_ACCEPTED",
              "Сначала получите согласие клиента с ценой и сроком доставки.",
            );
          }
          for (const item of current.items) {
            let stockDeducted = false;
            if (item.craftItemId) {
              const reserved = await transaction.craftItem.updateMany({
                where: {
                  id: item.craftItemId,
                  isPublished: true,
                  stockQuantity: { gte: item.quantity },
                },
                data: { stockQuantity: { decrement: item.quantity } },
              });
              if (reserved.count !== 1) {
                throw new HttpError(
                  409,
                  "SHOP_STOCK_INSUFFICIENT",
                  `Недостаточно готовых изделий «${item.name}». Заказ пока не подтверждён.`,
                );
              }
              stockDeducted = true;
            } else if (item.catalogItemId) {
              const product = await transaction.repairCatalogItem.findUnique({
                where: { id: item.catalogItemId },
                select: { type: true, active: true, stockQuantity: true },
              });
              if (!product || product.type !== "PRODUCT" || !product.active) {
                throw unavailableProduct();
              }
              if (product.stockQuantity !== null) {
                const reserved = await transaction.repairCatalogItem.updateMany(
                  {
                    where: {
                      id: item.catalogItemId,
                      type: "PRODUCT",
                      active: true,
                      stockQuantity: { gte: item.quantity },
                    },
                    data: { stockQuantity: { decrement: item.quantity } },
                  },
                );
                if (reserved.count !== 1) {
                  throw new HttpError(
                    409,
                    "SHOP_STOCK_INSUFFICIENT",
                    `Недостаточно товара «${item.name}» на складе. Заказ пока не подтверждён.`,
                  );
                }
                stockDeducted = true;
              }
            } else {
              throw unavailableProduct();
            }
            if (stockDeducted) {
              await transaction.shopOrderItem.update({
                where: { id: item.id },
                data: { stockDeducted: true },
              });
            }
          }
        } else if (status === "COMPLETED") {
          if (current.status !== "CONFIRMED") {
            throw new HttpError(
              409,
              "SHOP_ORDER_STATUS_CONFLICT",
              "Завершить можно только подтверждённый заказ.",
            );
          }
        } else if (
          current.status !== "PENDING" &&
          current.status !== "CONFIRMED"
        ) {
          throw new HttpError(
            409,
            "SHOP_ORDER_STATUS_CONFLICT",
            "Отменить можно только ожидающий или подтверждённый заказ.",
          );
        }

        if (status === "CANCELLED" && current.status === "CONFIRMED") {
          for (const item of current.items.filter(
            (entry) => entry.stockDeducted,
          )) {
            const restored = item.craftItemId
              ? await transaction.craftItem.updateMany({
                  where: { id: item.craftItemId },
                  data: { stockQuantity: { increment: item.quantity } },
                })
              : item.catalogItemId
                ? await transaction.repairCatalogItem.updateMany({
                    where: {
                      id: item.catalogItemId,
                      type: "PRODUCT",
                      stockQuantity: { not: null },
                    },
                    data: { stockQuantity: { increment: item.quantity } },
                  })
                : { count: 0 };
            if (restored.count !== 1) {
              throw new HttpError(
                409,
                "SHOP_STOCK_RESTORE_FAILED",
                `Не удалось вернуть товар «${item.name}» в остаток. Обратитесь к администратору.`,
              );
            }
            await transaction.shopOrderItem.update({
              where: { id: item.id },
              data: { stockDeducted: false },
            });
          }
        }

        return transaction.shopOrder.update({
          where: { id: orderId },
          data: {
            status,
            ...(status === "CONFIRMED" ? { confirmedAt: now } : {}),
            ...(status === "COMPLETED" ? { completedAt: now } : {}),
            ...(status === "CANCELLED" ? { cancelledAt: now } : {}),
          },
          include: adminOrderInclude,
        });
      });
      const statusLabels = {
        CONFIRMED: "подтверждён",
        COMPLETED: "выдан клиенту",
        CANCELLED: "отменён",
      } as const;
      await sendShopNotificationToAdministrators(
        database,
        {
          title: "Заказ в магазине обновлён",
          body: `Статус заказа ${statusLabels[status]}.`,
          data: { type: "shop_order_updated", orderId: order.id },
        },
        sendNotification,
        actor.id,
      );
      response.json({ order });
    },
  );

  return router;
};
