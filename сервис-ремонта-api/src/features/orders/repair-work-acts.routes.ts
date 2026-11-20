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
import { canAddRepairOrderItem } from "./order-policy.js";
import { registerRepairWorkActReviewRoute } from "./repair-work-act-review.routes.js";
import {
  type WorkActLine,
  bodyOf,
  orderIdOf,
  orderIdParams,
  parseSnapshot,
  revisionBody,
  saveWorkActBody,
  totalForLines,
  updatedWorkActInclude,
} from "./repair-work-act.shared.js";

export const createRepairWorkActsRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.put(
    "/orders/:orderId/work-act",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: saveWorkActBody }),
    async (_request, response) => {
      const orderId = orderIdOf(response);
      const input = bodyOf<z.infer<typeof saveWorkActBody>>(response);
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
        if (!order || !canAddRepairOrderItem(user.role, user.id, order)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          order.status !== "IN_PROGRESS" ||
          order.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_NOT_EDITABLE",
            "Черновик акта можно заполнять во время ремонта до оплаты.",
          );
        }
        if (order.workAct && order.workAct.status !== "DRAFT") {
          throw new HttpError(
            409,
            "WORK_ACT_ALREADY_SUBMITTED",
            "Переданный на согласование акт нельзя изменить.",
          );
        }
        if ((order.workAct?.revision ?? 0) !== input.expectedRevision) {
          throw new HttpError(
            409,
            "WORK_ACT_CHANGED",
            "Акт уже изменился. Обновите заявку и повторите действие.",
          );
        }

        const existingItems = new Map(
          order.items.map((item) => [item.id, item]),
        );
        const submittedExistingIds = new Set(
          input.items.flatMap((item) => item.orderItemId ?? []),
        );
        if (
          [...existingItems.keys()].some((id) => !submittedExistingIds.has(id))
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_BASE_ITEMS_REQUIRED",
            "Нельзя удалить исходные строки заявки из черновика акта.",
          );
        }

        const newCatalogIds = input.items.flatMap((item) =>
          item.orderItemId ? [] : (item.catalogItemId ?? []),
        );
        const newCatalogItems = newCatalogIds.length
          ? await transaction.repairCatalogItem.findMany({
              where: { id: { in: newCatalogIds }, active: true },
              select: {
                id: true,
                type: true,
                name: true,
                unitPriceRub: true,
                deviceTypes: true,
              },
            })
          : [];
        const catalogById = new Map(
          newCatalogItems.map((item) => [item.id, item]),
        );
        const lines: WorkActLine[] = input.items.map((requested) => {
          if (requested.orderItemId) {
            const existing = existingItems.get(requested.orderItemId);
            if (
              !existing ||
              requested.catalogItemId !== existing.catalogItemId ||
              requested.quantity !== existing.quantity
            ) {
              throw new HttpError(
                409,
                "WORK_ACT_BASE_ITEM_CHANGED",
                "Исходная строка заявки изменилась. Обновите акт.",
              );
            }
            return {
              lineId: existing.id,
              orderItemId: existing.id,
              catalogItemId: existing.catalogItemId,
              type: existing.type,
              name: existing.name,
              quantity: existing.quantity,
              unitPriceRub: existing.unitPriceRub,
            };
          }
          const catalogItem = requested.catalogItemId
            ? catalogById.get(requested.catalogItemId)
            : undefined;
          if (!catalogItem) {
            throw new HttpError(
              409,
              "WORK_ACT_CATALOG_ITEM_UNAVAILABLE",
              "Позиция уже недоступна. Обновите каталог.",
            );
          }
          if (
            catalogItem.type !== "PRODUCT" &&
            !catalogItem.deviceTypes.includes(
              order.deviceType as (typeof catalogItem.deviceTypes)[number],
            )
          ) {
            throw new HttpError(
              409,
              "WORK_ACT_DEVICE_TYPE_MISMATCH",
              "Позиция не относится к типу устройства в заявке.",
            );
          }
          return {
            lineId: requested.lineId,
            orderItemId: null,
            catalogItemId: catalogItem.id,
            type: catalogItem.type,
            name: catalogItem.name,
            quantity: requested.quantity,
            unitPriceRub: catalogItem.unitPriceRub,
          };
        });
        totalForLines(lines);

        if (order.workAct) {
          const updated = await transaction.repairWorkAct.updateMany({
            where: {
              id: order.workAct.id,
              status: "DRAFT",
              revision: input.expectedRevision,
            },
            data: {
              revision: { increment: 1 },
              itemsSnapshot: lines as unknown as Prisma.InputJsonValue,
            },
          });
          if (updated.count !== 1) {
            throw new HttpError(
              409,
              "WORK_ACT_CHANGED",
              "Акт уже изменился. Обновите заявку и повторите действие.",
            );
          }
          return transaction.repairWorkAct.findUniqueOrThrow({
            where: { id: order.workAct.id },
            include: updatedWorkActInclude,
          });
        }
        if (input.expectedRevision !== 0) {
          throw new HttpError(
            409,
            "WORK_ACT_CHANGED",
            "Акт уже изменился. Обновите заявку и повторите действие.",
          );
        }
        const created = await transaction.repairWorkAct.create({
          data: {
            orderId,
            createdById: user.id,
            revision: 1,
            itemsSnapshot: lines as unknown as Prisma.InputJsonValue,
          },
          include: updatedWorkActInclude,
        });
        await transaction.repairOrder.updateMany({
          where: { id: orderId, workActRequired: false },
          data: { workActRequired: true },
        });
        return created;
      });
      response.json({ workAct });
    },
  );

  router.patch(
    "/orders/:orderId/work-act/submit",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: revisionBody }),
    async (_request, response) => {
      const orderId = orderIdOf(response);
      const { expectedRevision } =
        bodyOf<z.infer<typeof revisionBody>>(response);
      const user = getAuthenticatedUser(response);
      const workAct = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE`;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: { items: true, receipt: true, workAct: true },
        });
        if (!order || !canAddRepairOrderItem(user.role, user.id, order)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        const act = order.workAct;
        if (
          !act ||
          act.status !== "DRAFT" ||
          act.revision !== expectedRevision
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_CHANGED",
            "Черновик акта уже изменился. Обновите заявку.",
          );
        }
        if (
          order.status !== "IN_PROGRESS" ||
          order.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_NOT_SUBMITTABLE",
            "Для этой заявки нельзя подготовить акт к согласованию.",
          );
        }
        const lines = parseSnapshot(act.itemsSnapshot);
        totalForLines(lines);
        const update = await transaction.repairWorkAct.updateMany({
          where: { id: act.id, status: "DRAFT", revision: expectedRevision },
          data: {
            status: "PENDING",
            submittedAt: new Date(),
            revision: { increment: 1 },
          },
        });
        if (update.count !== 1) {
          throw new HttpError(
            409,
            "WORK_ACT_CHANGED",
            "Акт уже изменился. Обновите заявку.",
          );
        }
        await transaction.repairEstimate.updateMany({
          where: { orderId, kind: "ADDITIONAL", status: "PENDING" },
          data: {
            status: "SUPERSEDED",
            customerResponseNote: "Заменена актом выполненных работ.",
            respondedAt: new Date(),
          },
        });
        return transaction.repairWorkAct.findUniqueOrThrow({
          where: { id: act.id },
          include: updatedWorkActInclude,
        });
      });
      response.json({ workAct });
    },
  );
  registerRepairWorkActReviewRoute(router, database);
  return router;
};
