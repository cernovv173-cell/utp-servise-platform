import { Router } from "express";
import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { isInventoryCatalogItem } from "../catalog/catalog-policy.js";
import { sendRepairOrderNotificationForId } from "../notifications/push-notifications.js";
import {
  bodyOf,
  orderIdOf,
  orderIdParams,
  parseSnapshot,
  reviewBody,
  totalForLines,
  updatedWorkActInclude,
} from "./repair-work-act.shared.js";

export const registerRepairWorkActReviewRoute = (
  router: Router,
  database: DatabaseClient,
): void => {
  const requireAuth = createRequireAuth(database);

  router.patch(
    "/orders/:orderId/work-act/review",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: reviewBody }),
    async (_request, response) => {
      const orderId = orderIdOf(response);
      const input = bodyOf<z.infer<typeof reviewBody>>(response);
      const user = getAuthenticatedUser(response);
      const workAct = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: {
            items: { orderBy: { createdAt: "asc" } },
            receipt: true,
            workAct: true,
          },
        });
        const act = order?.workAct;
        if (!order || !act) {
          throw new HttpError(
            404,
            "WORK_ACT_NOT_FOUND",
            "Акт выполненных работ не найден.",
          );
        }
        if (
          act.status !== "PENDING" ||
          act.revision !== input.expectedRevision
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_CHANGED",
            "Акт уже обработан или изменился. Обновите заявку.",
          );
        }
        if (
          order.status !== "IN_PROGRESS" ||
          order.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_NOT_REVIEWABLE",
            "Сейчас нельзя подтвердить акт этой заявки.",
          );
        }
        const submitted = parseSnapshot(act.itemsSnapshot);
        const includedIds = new Set(input.includedLineIds);
        if (
          input.includedLineIds.some(
            (lineId) => !submitted.some((line) => line.lineId === lineId),
          )
        ) {
          throw new HttpError(
            400,
            "WORK_ACT_SELECTION_INVALID",
            "В акте выбрана неизвестная строка.",
          );
        }
        const approved = submitted.filter((line) =>
          includedIds.has(line.lineId),
        );
        const removed = submitted.filter(
          (line) => !includedIds.has(line.lineId),
        );
        totalForLines(approved);

        const currentOrderItems = new Map(
          order.items.map((item) => [item.id, item]),
        );
        const currentIdsInAct = new Set(
          submitted.flatMap((line) => line.orderItemId ?? []),
        );
        if (
          [...currentOrderItems.keys()].some((id) => !currentIdsInAct.has(id))
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_BASE_ITEMS_REQUIRED",
            "Состав заявки изменился после подготовки акта.",
          );
        }
        for (const line of submitted.filter((item) => item.orderItemId)) {
          const current = currentOrderItems.get(line.orderItemId!);
          if (
            !current ||
            current.catalogItemId !== line.catalogItemId ||
            current.quantity !== line.quantity ||
            current.type !== line.type ||
            current.name !== line.name ||
            current.unitPriceRub !== line.unitPriceRub
          ) {
            throw new HttpError(
              409,
              "WORK_ACT_BASE_ITEM_CHANGED",
              "Исходная строка заявки изменилась. Обновите акт.",
            );
          }
        }

        const catalogIds = [
          ...new Set([
            ...order.items.flatMap((item) => item.catalogItemId ?? []),
            ...approved.flatMap((item) => item.catalogItemId ?? []),
          ]),
        ];
        const catalogItems = catalogIds.length
          ? await transaction.repairCatalogItem.findMany({
              where: { id: { in: catalogIds } },
              select: { id: true, type: true, stockQuantity: true },
            })
          : [];
        const catalogById = new Map(
          catalogItems.map((item) => [item.id, item]),
        );
        const oldQuantities = new Map<string, number>();
        const newQuantities = new Map<string, number>();
        for (const item of order.items) {
          if (item.catalogItemId && isInventoryCatalogItem(item.type)) {
            oldQuantities.set(
              item.catalogItemId,
              (oldQuantities.get(item.catalogItemId) ?? 0) + item.quantity,
            );
          }
        }
        for (const line of approved) {
          if (line.catalogItemId) {
            const catalogItem = catalogById.get(line.catalogItemId);
            if (!catalogItem || catalogItem.type !== line.type) {
              throw new HttpError(
                409,
                "WORK_ACT_CATALOG_ITEM_CHANGED",
                "Позиция изменилась или удалена. Проверьте строки акта.",
              );
            }
            if (isInventoryCatalogItem(line.type)) {
              newQuantities.set(
                line.catalogItemId,
                (newQuantities.get(line.catalogItemId) ?? 0) + line.quantity,
              );
            }
          }
        }
        for (const catalogId of new Set([
          ...oldQuantities.keys(),
          ...newQuantities.keys(),
        ])) {
          const catalogItem = catalogById.get(catalogId);
          if (
            !catalogItem ||
            !isInventoryCatalogItem(catalogItem.type) ||
            catalogItem.stockQuantity === null
          )
            continue;
          const delta =
            (oldQuantities.get(catalogId) ?? 0) -
            (newQuantities.get(catalogId) ?? 0);
          if (delta > 0) {
            await transaction.repairCatalogItem.updateMany({
              where: { id: catalogId },
              data: { stockQuantity: { increment: delta } },
            });
          } else if (delta < 0) {
            const update = await transaction.repairCatalogItem.updateMany({
              where: { id: catalogId, stockQuantity: { gte: -delta } },
              data: { stockQuantity: { decrement: -delta } },
            });
            if (update.count !== 1) {
              throw new HttpError(
                409,
                catalogItem.type === "PRODUCT"
                  ? "INSUFFICIENT_PRODUCT_STOCK"
                  : "INSUFFICIENT_SPARE_PART_STOCK",
                "Недостаточно остатка на складе для утверждённых строк акта.",
              );
            }
          }
        }

        const includedExistingIds = new Set(
          approved.flatMap((line) => line.orderItemId ?? []),
        );
        const removedOrderItemIds = order.items
          .filter((item) => !includedExistingIds.has(item.id))
          .map((item) => item.id);
        if (removedOrderItemIds.length) {
          await transaction.repairOrderItem.deleteMany({
            where: { orderId, id: { in: removedOrderItemIds } },
          });
        }
        for (const line of approved.filter((item) => !item.orderItemId)) {
          await transaction.repairOrderItem.create({
            data: {
              orderId,
              catalogItemId: line.catalogItemId,
              type: line.type,
              name: line.name,
              quantity: line.quantity,
              unitPriceRub: line.unitPriceRub,
              addedById: act.createdById,
            },
          });
        }

        const updated = await transaction.repairWorkAct.updateMany({
          where: {
            id: act.id,
            status: "PENDING",
            revision: input.expectedRevision,
          },
          data: {
            status: "APPROVED",
            revision: { increment: 1 },
            approvedById: user.id,
            approvedAt: new Date(),
            approvedItemsSnapshot: approved as unknown as Prisma.InputJsonValue,
            removedItemsSnapshot: removed as unknown as Prisma.InputJsonValue,
          },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "WORK_ACT_CHANGED",
            "Акт уже изменился. Обновите заявку.",
          );
        }
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: order.status,
            to: order.status,
            note: `Администратор утвердил акт выполненных работ; удалено строк: ${removed.length}.`,
          },
        });
        return transaction.repairWorkAct.findUniqueOrThrow({
          where: { id: act.id },
          include: updatedWorkActInclude,
        });
      });
      await sendRepairOrderNotificationForId(
        database,
        orderId,
        user.id,
        "Администратор подтвердил акт выполненных работ. Состав и стоимость зафиксированы в заявке.",
        "Акт выполненных работ подтверждён",
      );
      response.json({ workAct });
    },
  );
};
