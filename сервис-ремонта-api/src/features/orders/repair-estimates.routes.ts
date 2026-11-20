import { Router } from "express";
import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { RepairOrderItemType } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { isInventoryCatalogItem } from "../catalog/catalog-policy.js";
import { sendRepairOrderNotification } from "../notifications/push-notifications.js";
import { canAddRepairOrderItem, canViewRepairOrder } from "./order-policy.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const reviewParams = z.object({
  orderId: z.string().uuid(),
  estimateId: z.string().uuid(),
});
const estimateReviewPaths = [
  "/orders/:orderId/estimates/:estimateId/review",
  "/orders/:orderId/estimates/:estimateId/response",
];

const submitEstimateBody = z
  .object({
    diagnosis: z.string().trim().min(3).max(2000),
    items: z
      .array(
        z
          .object({
            catalogItemId: z.string().uuid(),
            quantity: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .superRefine(({ items }, context) => {
    const ids = items.map((item) => item.catalogItemId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        message: "Каждую позицию каталога можно добавить в смету один раз.",
        path: ["items"],
      });
    }
  });

const reviewEstimateBody = z
  .object({
    decision: z.enum(["APPROVED", "DECLINED"]),
    note: z.string().trim().max(500).optional(),
    approvalMethod: z.literal("PHONE"),
  })
  .strict();

const orderIdOf = (response: { locals: { input?: unknown } }): string =>
  (response.locals.input as { readonly params: { readonly orderId: string } })
    .params.orderId;

const repairEstimateSnapshotSchema = z.array(
  z
    .object({
      catalogItemId: z.string().uuid(),
      type: z.enum(["SERVICE", "SPARE_PART", "PRODUCT"]),
      name: z.string().min(1).max(160),
      quantity: z.number().int().min(1).max(99),
      unitPriceRub: z.number().int().min(0).max(2_147_483_647),
    })
    .strict(),
);

type EstimateSnapshotItem = z.infer<
  typeof repairEstimateSnapshotSchema
>[number];

const isEstimateSnapshotItem = (
  value: unknown,
): value is EstimateSnapshotItem =>
  repairEstimateSnapshotSchema.element.safeParse(value).success;

const parseSnapshot = (value: Prisma.JsonValue): EstimateSnapshotItem[] => {
  const parsed = repairEstimateSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new HttpError(
      500,
      "ESTIMATE_SNAPSHOT_INVALID",
      "Не удалось прочитать сохранённую смету.",
    );
  }
  return parsed.data;
};

export const createRepairEstimatesRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.post(
    "/orders/:orderId/estimates",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: submitEstimateBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const orderId = orderIdOf(response);
      const body = (
        response.locals.input as {
          readonly body: z.infer<typeof submitEstimateBody>;
        }
      ).body;

      const result = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            customerId: true,
            assignedTechnicianId: true,
            serviceNumber: true,
            status: true,
            deviceType: true,
            receipt: { select: { paymentStatus: true } },
            estimates: {
              orderBy: { version: "desc" },
              take: 1,
              select: { version: true, status: true, kind: true },
            },
          },
        });
        if (!order || !canAddRepairOrderItem(user.role, user.id, order)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          !["ASSIGNED", "IN_PROGRESS"].includes(order.status) ||
          order.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "ESTIMATE_NOT_AVAILABLE",
            "Смету можно подготовить только для назначенной заявки до закрытия чека.",
          );
        }

        const latestEstimate = order.estimates[0];
        if (
          order.status === "ASSIGNED" &&
          latestEstimate?.status === "APPROVED"
        ) {
          throw new HttpError(
            409,
            "INITIAL_ESTIMATE_ALREADY_APPROVED",
            "Первоначальная смета уже подтверждена. Дополнительную смету можно подготовить после начала ремонта.",
          );
        }

        const catalogItems = await transaction.repairCatalogItem.findMany({
          where: {
            id: { in: body.items.map((item) => item.catalogItemId) },
            active: true,
          },
          select: {
            id: true,
            type: true,
            name: true,
            unitPriceRub: true,
            stockQuantity: true,
            deviceTypes: true,
          },
        });
        if (catalogItems.length !== body.items.length) {
          throw new HttpError(
            409,
            "ESTIMATE_CATALOG_ITEM_UNAVAILABLE",
            "Одна или несколько позиций уже недоступны. Обновите каталог.",
          );
        }

        const catalogById = new Map(
          catalogItems.map((item) => [item.id, item]),
        );
        if (
          catalogItems.some(
            (item) =>
              item.type !== "PRODUCT" &&
              !item.deviceTypes.includes(
                order.deviceType as (typeof item.deviceTypes)[number],
              ),
          )
        ) {
          throw new HttpError(
            409,
            "ESTIMATE_DEVICE_TYPE_MISMATCH",
            "Выбранная услуга или запчасть не относится к типу устройства этой заявки.",
          );
        }
        const snapshot = body.items.map((requestedItem) => {
          const item = catalogById.get(requestedItem.catalogItemId);
          if (!item) {
            throw new HttpError(
              409,
              "ESTIMATE_CATALOG_ITEM_UNAVAILABLE",
              "Одна или несколько позиций уже недоступны. Обновите каталог.",
            );
          }
          if (
            isInventoryCatalogItem(item.type) &&
            item.stockQuantity !== null &&
            item.stockQuantity < requestedItem.quantity
          ) {
            throw new HttpError(
              409,
              item.type === "PRODUCT"
                ? "INSUFFICIENT_PRODUCT_STOCK"
                : "INSUFFICIENT_SPARE_PART_STOCK",
              `Недостаточно ${item.type === "PRODUCT" ? "товара" : "запчастей"} для этой сметы.`,
            );
          }
          return {
            catalogItemId: item.id,
            type: item.type,
            name: item.name,
            quantity: requestedItem.quantity,
            unitPriceRub: item.unitPriceRub,
          };
        });
        const totalRub = snapshot.reduce(
          (total, item) => total + item.quantity * item.unitPriceRub,
          0,
        );
        if (totalRub > 2_147_483_647) {
          throw new HttpError(
            400,
            "ESTIMATE_TOTAL_TOO_LARGE",
            "Итоговая стоимость сметы превышает допустимое значение.",
          );
        }

        if (latestEstimate && latestEstimate.status !== "APPROVED") {
          await transaction.repairEstimate.updateMany({
            where: {
              orderId,
              status: { in: ["PENDING", "DECLINED"] },
            },
            data: { status: "SUPERSEDED" },
          });
        }
        const version = (latestEstimate?.version ?? 0) + 1;
        const kind = order.status === "IN_PROGRESS" ? "ADDITIONAL" : "INITIAL";
        const estimate = await transaction.repairEstimate.create({
          data: {
            orderId,
            createdById: user.id,
            version,
            kind,
            status: "PENDING",
            diagnosis: body.diagnosis,
            itemsSnapshot: snapshot as Prisma.InputJsonValue,
            totalRub,
          },
          include: { createdBy: { select: { id: true, displayName: true } } },
        });
        return { estimate, order };
      });

      await sendRepairOrderNotification(
        database,
        result.order,
        user.id,
        `Смета №${result.estimate.version} по заявке ${result.order.serviceNumber} подготовлена мастером для согласования с клиентом по телефону.`,
      );
      response.status(201).json({ estimate: result.estimate });
    },
  );

  router.patch(
    estimateReviewPaths,
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: reviewParams, body: reviewEstimateBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { orderId, estimateId } = (
        response.locals.input as {
          readonly params: z.infer<typeof reviewParams>;
        }
      ).params;
      const body = (
        response.locals.input as {
          readonly body: z.infer<typeof reviewEstimateBody>;
        }
      ).body;

      const result = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            customerId: true,
            assignedTechnicianId: true,
            serviceNumber: true,
            status: true,
          },
        });
        if (
          !order ||
          order.assignedTechnicianId !== user.id ||
          !canViewRepairOrder(user.role, user.id, order)
        ) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        const estimate = await transaction.repairEstimate.findFirst({
          where: { id: estimateId, orderId, status: "PENDING" },
        });
        if (!estimate) {
          throw new HttpError(
            409,
            "ESTIMATE_NO_LONGER_PENDING",
            "Эта версия сметы уже обработана или заменена новой.",
          );
        }
        if (order.status !== "ASSIGNED" && order.status !== "IN_PROGRESS") {
          throw new HttpError(
            409,
            "ESTIMATE_RESPONSE_NOT_AVAILABLE",
            "По этой заявке сейчас нельзя ответить на смету.",
          );
        }

        if (body.decision === "APPROVED") {
          const items = parseSnapshot(estimate.itemsSnapshot);
          for (const item of items) {
            if (!isEstimateSnapshotItem(item)) {
              throw new HttpError(
                500,
                "ESTIMATE_SNAPSHOT_INVALID",
                "Не удалось прочитать сохранённую смету.",
              );
            }
            const catalogItem = await transaction.repairCatalogItem.findUnique({
              where: { id: item.catalogItemId },
              select: { id: true, type: true, stockQuantity: true },
            });
            if (!catalogItem || catalogItem.type !== item.type) {
              throw new HttpError(
                409,
                "ESTIMATE_CATALOG_ITEM_CHANGED",
                "Состав каталога изменился. Попросите мастера подготовить новую смету.",
              );
            }
            if (
              isInventoryCatalogItem(catalogItem.type) &&
              catalogItem.stockQuantity !== null
            ) {
              const stockUpdate =
                await transaction.repairCatalogItem.updateMany({
                  where: {
                    id: catalogItem.id,
                    stockQuantity: { gte: item.quantity },
                  },
                  data: { stockQuantity: { decrement: item.quantity } },
                });
              if (stockUpdate.count !== 1) {
                throw new HttpError(
                  409,
                  catalogItem.type === "PRODUCT"
                    ? "INSUFFICIENT_PRODUCT_STOCK"
                    : "INSUFFICIENT_SPARE_PART_STOCK",
                  "Остаток изменился после отправки сметы. Попросите мастера обновить предложение.",
                );
              }
            }
            await transaction.repairOrderItem.create({
              data: {
                orderId,
                catalogItemId: item.catalogItemId,
                type: item.type as RepairOrderItemType,
                name: item.name,
                quantity: item.quantity,
                unitPriceRub: item.unitPriceRub,
                addedById: estimate.createdById,
              },
            });
          }
        }

        const updated = await transaction.repairEstimate.updateMany({
          where: { id: estimateId, orderId, status: "PENDING" },
          data: {
            status: body.decision,
            customerResponseNote: body.note || null,
            responseMethod: body.approvalMethod,
            respondedById: user.id,
            respondedAt: new Date(),
          },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "ESTIMATE_CHANGED",
            "Смета уже изменилась. Обновите заявку и повторите действие.",
          );
        }
        const savedEstimate =
          await transaction.repairEstimate.findUniqueOrThrow({
            where: { id: estimateId },
            include: { createdBy: { select: { id: true, displayName: true } } },
          });
        return { estimate: savedEstimate, order };
      });

      await sendRepairOrderNotification(
        database,
        result.order,
        user.id,
        `Мастер зафиксировал по телефону ${body.decision === "APPROVED" ? "согласие клиента со сметой" : "отказ клиента от сметы"} №${result.estimate.version} по заявке ${result.order.serviceNumber}.`,
      );
      response.json({ estimate: result.estimate });
    },
  );

  return router;
};
