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
import { sendPushNotification } from "../notifications/push-notifications.js";
import { sendShopNotificationToAdministrators } from "./shop-notifications.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const deliveryOfferBody = z
  .object({
    deliveryFeeRub: z.number().int().min(0).max(1_000_000),
    deliveryWindow: z.string().trim().min(3).max(160),
  })
  .strict();
const deliveryResponseBody = z.object({ accept: z.boolean() }).strict();

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

export const createShopDeliveryRouter = (
  database: DatabaseClient,
  sendNotification: typeof sendPushNotification = sendPushNotification,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.patch(
    "/admin/shop/orders/:orderId/delivery-offer",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: deliveryOfferBody }),
    async (_request, response) => {
      const actor = getAuthenticatedUser(response);
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const offer = bodyOf<z.infer<typeof deliveryOfferBody>>(response);
      const { order, shouldNotify } = await database.$transaction(
        async (transaction) => {
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
          if (
            current.status !== "PENDING" ||
            current.deliveryMethod !== "COURIER"
          ) {
            throw new HttpError(
              409,
              "SHOP_DELIVERY_OFFER_CONFLICT",
              "Предложить доставку можно только для ожидающего курьерского заказа.",
            );
          }
          const deliveryWindow = offer.deliveryWindow.trim();
          const shouldNotify =
            current.deliveryFeeRub !== offer.deliveryFeeRub ||
            current.deliveryWindow !== deliveryWindow ||
            current.deliveryOfferAcceptedAt !== null;
          return {
            order: await transaction.shopOrder.update({
              where: { id: orderId },
              data: {
                deliveryFeeRub: offer.deliveryFeeRub,
                deliveryWindow,
                deliveryOfferAcceptedAt: null,
              },
              include: adminOrderInclude,
            }),
            shouldNotify,
          };
        },
      );
      if (shouldNotify) {
        await sendShopNotificationToAdministrators(
          database,
          {
            title: "Предложение доставки изменено",
            body: "В заказе магазина обновлены цена или время доставки.",
            data: { type: "shop_order_updated", orderId: order.id },
          },
          sendNotification,
          actor.id,
        );
      }
      response.json({ order });
    },
  );

  router.patch(
    "/shop/orders/:orderId/delivery-response",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: orderIdParams, body: deliveryResponseBody }),
    async (_request, response) => {
      const customer = getAuthenticatedUser(response);
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { accept } = bodyOf<z.infer<typeof deliveryResponseBody>>(response);
      const { order, shouldNotify } = await database.$transaction(
        async (transaction) => {
          await transaction.$queryRaw`
          SELECT "id" FROM "shop_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
          const current = await transaction.shopOrder.findUnique({
            where: { id: orderId },
            include: { items: true },
          });
          if (!current || current.customerId !== customer.id) {
            throw new HttpError(
              404,
              "SHOP_ORDER_NOT_FOUND",
              "Заказ магазина не найден.",
            );
          }
          if (
            current.status !== "PENDING" ||
            current.deliveryMethod !== "COURIER" ||
            current.deliveryFeeRub === null ||
            current.deliveryWindow === null
          ) {
            throw new HttpError(
              409,
              "SHOP_DELIVERY_OFFER_NOT_READY",
              "Для этого заказа пока нет предложения доставки.",
            );
          }
          if (accept && current.deliveryOfferAcceptedAt) {
            return { order: current, shouldNotify: false };
          }
          const now = new Date();
          return {
            order: await transaction.shopOrder.update({
              where: { id: orderId },
              data: accept
                ? { deliveryOfferAcceptedAt: now }
                : { status: "CANCELLED", cancelledAt: now },
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
            title: "Ответ по доставке магазина",
            body: accept
              ? "Клиент принял предложение доставки."
              : "Клиент отклонил доставку; заказ отменён.",
            data: { type: "shop_delivery_response", orderId },
          },
          sendNotification,
        );
      }
      response.json({ order });
    },
  );

  return router;
};
