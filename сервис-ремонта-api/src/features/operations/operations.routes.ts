import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";

const dateRangeQuery = z
  .object({
    from: z.string().datetime({ offset: true }),
    to: z.string().datetime({ offset: true }),
  })
  .strict()
  .refine(({ from, to }) => Date.parse(from) < Date.parse(to), {
    message: "Начало периода должно быть раньше его окончания.",
    path: ["to"],
  });

const orderIdParams = z.object({ orderId: z.string().uuid() });
const priorityBody = z
  .object({ priority: z.enum(["NORMAL", "URGENT"]) })
  .strict();

const queryOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly query: T }).query;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;

export const createOperationsRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/admin/operations/calendar",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ query: dateRangeQuery }),
    async (_request, response) => {
      const { from, to } = queryOf<z.infer<typeof dateRangeQuery>>(response);
      const orders = await database.repairOrder.findMany({
        where: {
          preferredAt: { gte: new Date(from), lt: new Date(to) },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        select: {
          id: true,
          serviceNumber: true,
          deviceType: true,
          deviceBrand: true,
          deviceModel: true,
          problem: true,
          city: true,
          street: true,
          house: true,
          preferredAt: true,
          expectedCompletionAt: true,
          status: true,
          priority: true,
          customer: { select: { displayName: true } },
          assignedTechnician: { select: { id: true, displayName: true } },
        },
        orderBy: [{ preferredAt: "asc" }, { priority: "desc" }],
        take: 500,
      });
      response.json({ orders });
    },
  );

  router.get(
    "/admin/operations/procurement",
    requireAuth,
    requireRoles("ADMIN", "PROCUREMENT"),
    async (_request, response) => {
      const [catalogItems, activeEstimateParts] = await Promise.all([
        database.repairCatalogItem.findMany({
          where: { type: "SPARE_PART", active: true },
          select: {
            id: true,
            name: true,
            stockQuantity: true,
            minimumStockQuantity: true,
            unitPriceRub: true,
          },
          orderBy: { name: "asc" },
        }),
        database.repairOrderItem.findMany({
          where: {
            type: "SPARE_PART",
            catalogItemId: { not: null },
            order: {
              status: { in: ["ASSIGNED", "IN_PROGRESS"] },
              estimates: { some: { status: "APPROVED" } },
            },
          },
          select: { catalogItemId: true, quantity: true },
          take: 5_000,
        }),
      ]);

      const estimateDemand = new Map<string, number>();
      for (const item of activeEstimateParts) {
        if (item.catalogItemId) {
          estimateDemand.set(
            item.catalogItemId,
            (estimateDemand.get(item.catalogItemId) ?? 0) + item.quantity,
          );
        }
      }

      const items = catalogItems
        .map((item) => {
          const stockQuantity = item.stockQuantity ?? 0;
          const minimumStockQuantity = item.minimumStockQuantity ?? 0;
          return {
            ...item,
            stockQuantity,
            minimumStockQuantity,
            recommendedPurchase: Math.max(
              0,
              minimumStockQuantity - stockQuantity,
            ),
            activeEstimateQuantity: estimateDemand.get(item.id) ?? 0,
          };
        })
        .filter(
          (item) =>
            item.recommendedPurchase > 0 || item.activeEstimateQuantity > 0,
        );

      response.json({ items });
    },
  );

  router.get(
    "/admin/operations/dashboard",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const now = new Date();
      const periodStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const [
        activeOrders,
        overdueOrders,
        newOrders,
        completedEvents,
        paidReceipts,
      ] = await Promise.all([
        database.repairOrder.count({
          where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        }),
        database.repairOrder.count({
          where: {
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            expectedCompletionAt: { lt: now },
          },
        }),
        database.repairOrder.count({
          where: { createdAt: { gte: periodStart } },
        }),
        database.repairStatusEvent.findMany({
          where: { to: "COMPLETED", createdAt: { gte: periodStart } },
          select: {
            createdAt: true,
            order: {
              select: {
                createdAt: true,
                items: {
                  where: { type: "SERVICE" },
                  select: { name: true, quantity: true },
                },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 1_000,
        }),
        database.repairReceipt.findMany({
          where: { paymentStatus: "PAID", paidAt: { gte: periodStart } },
          select: { totalRub: true, bonusDiscountRub: true },
          take: 5_000,
        }),
      ]);

      const servicePopularity = new Map<string, number>();
      let repairDurationTotalMilliseconds = 0;
      for (const event of completedEvents) {
        repairDurationTotalMilliseconds += Math.max(
          0,
          event.createdAt.getTime() - event.order.createdAt.getTime(),
        );
        for (const item of event.order.items) {
          servicePopularity.set(
            item.name,
            (servicePopularity.get(item.name) ?? 0) + item.quantity,
          );
        }
      }

      const popularWorks = [...servicePopularity.entries()]
        .map(([name, completedQuantity]) => ({ name, completedQuantity }))
        .sort((left, right) => right.completedQuantity - left.completedQuantity)
        .slice(0, 5);
      const collectedRub = paidReceipts.reduce(
        (total, receipt) =>
          total + Math.max(0, receipt.totalRub - receipt.bonusDiscountRub),
        0,
      );

      response.json({
        periodDays: 30,
        activeOrders,
        overdueOrders,
        newOrders,
        completedOrders: completedEvents.length,
        averageRepairMinutes:
          completedEvents.length === 0
            ? null
            : Math.round(
                repairDurationTotalMilliseconds /
                  completedEvents.length /
                  60_000,
              ),
        collectedRub,
        popularWorks,
      });
    },
  );

  router.patch(
    "/admin/operations/orders/:orderId/priority",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: priorityBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { priority } = bodyOf<z.infer<typeof priorityBody>>(response);
      const order = await database.repairOrder
        .update({
          where: { id: orderId },
          data: { priority },
          select: { id: true, priority: true },
        })
        .catch((error: unknown) => {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "P2025"
          ) {
            throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
          }
          throw error;
        });
      response.json({ order });
    },
  );

  return router;
};
