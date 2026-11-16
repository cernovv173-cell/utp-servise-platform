import { Router } from "express";
import { z } from "zod";

import type { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { sendRepairOrderNotification } from "../notifications/push-notifications.js";
import { awardReferralForFirstPaidRepair } from "../referrals/referral-rewards.js";
import {
  TECHNICIAN_SALARY_RATE_PERCENT,
  calculateTechnicianSalaryRub,
} from "../salary/salary-calculation.js";
import {
  calculateEarnedPoints,
  calculateMaxBonusDiscount,
  calculateServiceBonusEligibleRub,
  canViewRepairOrder,
} from "./order-policy.js";
import { getRepairFollowUpScheduledAt } from "./repair-follow-up-policy.js";
import { assertWorkActApproved } from "./repair-work-act.shared.js";
import {
  REPAIR_WARRANTY_DAYS,
  REPAIR_WARRANTY_TERMS,
  getRepairWarrantyExpiresAt,
} from "./warranty-policy.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const paymentMethod = z.enum([
  "CASH",
  "CARD_TERMINAL",
  "BANK_TRANSFER",
  "OTHER",
]);
const releaseBody = z
  .object({
    expectedAmountRub: z.number().int().min(0).max(2_147_483_647),
    paymentMethod: paymentMethod.optional(),
    redeemBonuses: z.boolean().optional(),
  })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const totalForItems = (
  items: readonly { quantity: number; unitPriceRub: number }[],
) => {
  const total = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPriceRub,
    0,
  );
  if (total > 2_147_483_647) {
    throw new HttpError(
      400,
      "ORDER_TOTAL_TOO_LARGE",
      "Итог заказа превышает допустимое значение.",
    );
  }
  return total;
};

const isDiagnosisOnlyReturn = (order: {
  visitScenarioVersion: number;
  diagnosisCompletedAt: Date | null;
  items: readonly unknown[];
  estimates: readonly { status: string }[];
}): boolean =>
  order.visitScenarioVersion > 0 &&
  order.diagnosisCompletedAt !== null &&
  order.items.length === 0 &&
  order.estimates.at(-1)?.status === "DECLINED";

export const createRepairOrderReleaseRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/orders/:orderId/release-summary",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        include: {
          items: true,
          receipt: true,
          workAct: { select: { status: true } },
          estimates: { orderBy: { version: "asc" }, select: { status: true } },
        },
      });
      if (!order || !canViewRepairOrder(user.role, user.id, order)) {
        throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
      }
      if (order.status !== "READY_FOR_PICKUP") {
        throw new HttpError(
          409,
          "ORDER_NOT_READY_FOR_PICKUP",
          "Заявка ещё не готова к выдаче.",
        );
      }
      const diagnosisOnlyReturn = isDiagnosisOnlyReturn(order);
      if (!diagnosisOnlyReturn) {
        assertWorkActApproved(order.workActRequired, order.workAct?.status);
      }
      const intake = await database.repairOrderIntake.findUnique({
        where: { orderId },
        select: { conditionSummary: true, intakeMediaObjectId: true },
      });
      if (!intake?.conditionSummary.trim() || !intake.intakeMediaObjectId) {
        throw new HttpError(
          409,
          "INTAKE_REQUIRED",
          "Перед выдачей заполните акт и добавьте одно фото или видео.",
        );
      }
      const repairSubtotalRub =
        order.receipt?.paymentStatus === "PAID"
          ? order.receipt.totalRub
          : totalForItems(order.items);
      const totalRub =
        order.receipt?.paymentStatus === "PAID"
          ? order.receipt.totalRub
          : repairSubtotalRub + order.diagnosisFeeRub + order.visitFeeRub;
      const balance = await database.loyaltyTransaction.aggregate({
        where: { customerId: order.customerId },
        _sum: { points: true },
      });
      const alreadyPaid = order.receipt?.paymentStatus === "PAID";
      const maxBonusDiscountRub = alreadyPaid
        ? 0
        : calculateMaxBonusDiscount(
            calculateServiceBonusEligibleRub(order.items),
            balance._sum.points ?? 0,
          );
      const redeemBonuses = alreadyPaid
        ? order.receipt!.bonusDiscountRub > 0
        : order.redeemBonuses;
      const bonusDiscountRub = alreadyPaid
        ? order.receipt!.bonusDiscountRub
        : redeemBonuses
          ? maxBonusDiscountRub
          : 0;
      response.json({
        orderId,
        serviceNumber: order.serviceNumber,
        totalRub,
        repairSubtotalRub:
          order.receipt?.paymentStatus === "PAID"
            ? order.receipt.totalRub - order.diagnosisFeeRub - order.visitFeeRub
            : repairSubtotalRub,
        diagnosisFeeRub: order.diagnosisFeeRub,
        visitFeeRub: order.visitFeeRub,
        bonusDiscountRub,
        maxBonusDiscountRub,
        redeemBonuses,
        amountDueRub: alreadyPaid
          ? 0
          : Math.max(0, totalRub - bonusDiscountRub),
        paymentStatus: order.receipt?.paymentStatus ?? "PENDING",
        paymentMethod: order.receipt?.paymentMethod ?? null,
        paymentMethods: ["CASH", "CARD_TERMINAL", "BANK_TRANSFER", "OTHER"],
      });
    },
  );

  router.post(
    "/orders/:orderId/release",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams, body: releaseBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof releaseBody>>(response);
      const user = getAuthenticatedUser(response);
      const result = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: {
            items: { orderBy: { createdAt: "asc" } },
            receipt: true,
            salaryEntry: true,
            workAct: { select: { status: true } },
            estimates: {
              orderBy: { version: "asc" },
              select: { status: true },
            },
            customer: { select: { displayName: true, phoneNumber: true } },
          },
        });
        if (!order || !canViewRepairOrder(user.role, user.id, order)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (order.status !== "READY_FOR_PICKUP") {
          throw new HttpError(
            409,
            "ORDER_NOT_READY_FOR_PICKUP",
            "Заявка уже изменилась или не готова к выдаче.",
          );
        }
        const diagnosisOnlyReturn = isDiagnosisOnlyReturn(order);
        if (!diagnosisOnlyReturn) {
          assertWorkActApproved(order.workActRequired, order.workAct?.status);
        }
        const intake = await transaction.repairOrderIntake.findUnique({
          where: { orderId },
          select: { conditionSummary: true, intakeMediaObjectId: true },
        });
        if (!intake?.conditionSummary.trim() || !intake.intakeMediaObjectId) {
          throw new HttpError(
            409,
            "INTAKE_REQUIRED",
            "Перед выдачей заполните акт и добавьте одно фото или видео.",
          );
        }

        const now = new Date();
        const alreadyPaid = order.receipt?.paymentStatus === "PAID";
        const repairSubtotalRub = alreadyPaid
          ? order.receipt!.totalRub
          : totalForItems(order.items);
        const totalRub = alreadyPaid
          ? order.receipt!.totalRub
          : repairSubtotalRub + order.diagnosisFeeRub + order.visitFeeRub;
        await transaction.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${order.customerId}::uuid FOR UPDATE
        `;
        const balance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: order.customerId },
          _sum: { points: true },
        });
        const shouldRedeemBonuses =
          !alreadyPaid && (input.redeemBonuses ?? order.redeemBonuses);
        const bonusDiscountRub = alreadyPaid
          ? order.receipt!.bonusDiscountRub
          : shouldRedeemBonuses
            ? calculateMaxBonusDiscount(
                calculateServiceBonusEligibleRub(order.items),
                balance._sum.points ?? 0,
              )
            : 0;
        const amountDueRub = alreadyPaid
          ? 0
          : Math.max(0, totalRub - bonusDiscountRub);
        if (input.expectedAmountRub !== amountDueRub) {
          throw new HttpError(
            409,
            "RELEASE_AMOUNT_CHANGED",
            "Сумма заказа изменилась. Обновите окно выдачи и проверьте её ещё раз.",
          );
        }
        if (!alreadyPaid && amountDueRub > 0 && !input.paymentMethod) {
          throw new HttpError(
            400,
            "PAYMENT_METHOD_REQUIRED",
            "Выберите способ оплаты.",
          );
        }

        const snapshot = alreadyPaid
          ? (order.receipt!.itemsSnapshot as Prisma.InputJsonValue)
          : ([
              ...order.items.map((item) => ({
                type: item.type,
                name: item.name,
                quantity: item.quantity,
                unitPriceRub: item.unitPriceRub,
                totalRub: item.quantity * item.unitPriceRub,
              })),
              ...(order.diagnosisFeeRub > 0
                ? [
                    {
                      type: "FEE",
                      name: "Диагностика",
                      quantity: 1,
                      unitPriceRub: order.diagnosisFeeRub,
                      totalRub: order.diagnosisFeeRub,
                      bonusEligible: false,
                    },
                  ]
                : []),
              ...(order.visitFeeRub > 0
                ? [
                    {
                      type: "FEE",
                      name: `Загородный выезд · ${order.visitVerifiedDistanceKm} км в одну сторону`,
                      quantity: 1,
                      unitPriceRub: order.visitFeeRub,
                      totalRub: order.visitFeeRub,
                      bonusEligible: false,
                    },
                  ]
                : []),
            ] as Prisma.InputJsonValue);
        const receiptData = {
          orderId,
          receiptNumber: `DOC-${order.serviceNumber}`,
          serviceNumber: order.serviceNumber,
          customerName: order.customer.displayName,
          customerPhone: order.contactPhone ?? order.customer.phoneNumber,
          issuedById: user.id,
          itemsSnapshot: snapshot,
          totalRub,
          bonusDiscountRub,
          paymentStatus: "PAID" as const,
          paymentMethod: alreadyPaid
            ? order.receipt!.paymentMethod
            : (input.paymentMethod ?? null),
          paidAt: alreadyPaid ? order.receipt!.paidAt : now,
          issuedAt: now,
        };
        const receipt = order.receipt
          ? await transaction.repairReceipt.update({
              where: { id: order.receipt.id },
              data: receiptData,
            })
          : await transaction.repairReceipt.create({ data: receiptData });

        const updatedCount = await transaction.repairOrder.updateMany({
          where: { id: orderId, status: "READY_FOR_PICKUP" },
          data: {
            status: "COMPLETED",
            bonusDiscountRub,
            ...(alreadyPaid ? {} : { redeemBonuses: shouldRedeemBonuses }),
          },
        });
        if (updatedCount.count !== 1) {
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список.",
          );
        }
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: "READY_FOR_PICKUP",
            to: "COMPLETED",
            note: alreadyPaid
              ? "Заказ выдан клиенту"
              : amountDueRub === 0
                ? "Заказ выдан клиенту; стоимость покрыта бонусами"
                : `Заказ выдан клиенту; оплата: ${input.paymentMethod}`,
          },
        });

        if (!diagnosisOnlyReturn) {
          const scheduledAt = getRepairFollowUpScheduledAt(now);
          await transaction.repairOrderFollowUp.create({
            data: { orderId, scheduledAt, nextAttemptAt: scheduledAt },
          });
        }

        const existingWarranty = await transaction.repairWarranty.findUnique({
          where: { orderId },
        });
        const warranty =
          existingWarranty ??
          (await transaction.repairWarranty.create({
            data: {
              orderId,
              warrantyNumber: `WTY-${order.serviceNumber}`,
              customerName: order.customer.displayName,
              deviceType: order.deviceType,
              repairSummary: order.problem,
              warrantyDays: REPAIR_WARRANTY_DAYS,
              terms: REPAIR_WARRANTY_TERMS,
              issuedAt: now,
              expiresAt: getRepairWarrantyExpiresAt(now),
              issuedById: user.id,
            },
          }));

        if (order.assignedTechnicianId && !order.salaryEntry) {
          const technician = await transaction.user.findUnique({
            where: { id: order.assignedTechnicianId },
            select: { salaryRatePercent: true },
          });
          const serviceTotalRub = calculateServiceBonusEligibleRub(order.items);
          const visitFeesRub = order.diagnosisFeeRub + order.visitFeeRub;
          const ratePercent =
            technician?.salaryRatePercent ?? TECHNICIAN_SALARY_RATE_PERCENT;
          await transaction.technicianSalaryEntry.create({
            data: {
              orderId,
              technicianId: order.assignedTechnicianId,
              serviceTotalRub,
              visitFeesRub,
              salaryRub:
                calculateTechnicianSalaryRub(serviceTotalRub, ratePercent) +
                visitFeesRub,
              ratePercent,
              earnedAt: now,
            },
          });
        }

        if (!alreadyPaid) {
          if (bonusDiscountRub > 0) {
            await transaction.loyaltyTransaction.create({
              data: {
                customerId: order.customerId,
                orderId,
                actorId: user.id,
                type: "REDEEM",
                points: -bonusDiscountRub,
                reason: `Списание по оплаченному чеку ${receipt.receiptNumber}`,
              },
            });
          }
          const earnedPoints = calculateEarnedPoints(amountDueRub);
          if (earnedPoints > 0) {
            await transaction.loyaltyTransaction.create({
              data: {
                customerId: order.customerId,
                orderId,
                actorId: user.id,
                type: "EARN",
                points: earnedPoints,
                reason: `Начисление 10% по оплаченному чеку ${receipt.receiptNumber}`,
              },
            });
          }
          await awardReferralForFirstPaidRepair(transaction, {
            inviteeId: order.customerId,
            orderId,
            serviceNumber: order.serviceNumber,
            actorId: user.id,
          });
        }
        const savedOrder = await transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: { items: true, receipt: true, warranty: true },
        });
        return { order: savedOrder, receipt, warranty };
      });

      await sendRepairOrderNotification(
        database,
        result.order,
        user.id,
        `Ремонт по заявке ${result.order.serviceNumber} завершён, техника выдана клиенту.`,
        "Ремонт завершён",
      );
      response.json(result);
    },
  );

  return router;
};
