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
  calculateServiceBonusEligibleRub,
} from "./order-policy.js";
import { getRepairFollowUpScheduledAt } from "./repair-follow-up-policy.js";
import {
  REPAIR_DIAGNOSIS_FEE_RUB,
  REPAIR_VISIT_RUB_PER_KM,
} from "./repair-visit-policy.js";
import {
  REPAIR_WARRANTY_DAYS,
  REPAIR_WARRANTY_TERMS,
  getRepairWarrantyExpiresAt,
} from "./warranty-policy.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const distanceBody = z
  .object({
    isWithinCity: z.boolean(),
    distanceKm: z.number().int().min(0).max(10000),
  })
  .strict()
  .refine(
    ({ isWithinCity, distanceKm }) =>
      isWithinCity ? distanceKm === 0 : distanceKm >= 1,
    {
      message: "Для адреса в Пушкино укажите 0 км; за городом — минимум 1 км.",
    },
  );
const pickupBody = z.object({ customerConsent: z.literal(true) }).strict();
const onsiteCompletionBody = z
  .object({
    repairAgreed: z.boolean(),
    repairPriceRub: z.number().int().min(0).max(2_147_483_647),
    paymentMethod: z.enum(["CASH", "BANK_TRANSFER"]),
  })
  .strict()
  .refine(
    ({ repairAgreed, repairPriceRub }) =>
      repairAgreed ? repairPriceRub > 0 : repairPriceRub === 0,
    {
      message:
        "Укажите цену согласованного ремонта или ноль при отказе от ремонта.",
    },
  );

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

export const createRepairVisitRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.patch(
    "/orders/:orderId/visit-distance",
    requireAuth,
    requireRoles("TECHNICIAN", "ADMIN"),
    validateRequest({ params: orderIdParams, body: distanceBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { distanceKm, isWithinCity } =
        bodyOf<z.infer<typeof distanceBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            assignedTechnicianId: true,
            status: true,
            repairLocation: true,
            visitScenarioVersion: true,
            visitIsWithinCity: true,
            diagnosisCompletedAt: true,
          },
        });
        if (
          !current ||
          (user.role === "TECHNICIAN" &&
            current.assignedTechnicianId !== user.id)
        ) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          current.visitScenarioVersion < 1 ||
          current.repairLocation !== "CUSTOMER_ADDRESS"
        ) {
          throw new HttpError(
            409,
            "VISIT_DISTANCE_NOT_APPLICABLE",
            "В заявке нет сценария выезда мастера.",
          );
        }
        if (current.diagnosisCompletedAt) {
          throw new HttpError(
            409,
            "VISIT_DISTANCE_LOCKED",
            "После завершения диагностики километраж и плата за выезд уже зафиксированы.",
          );
        }
        if (current.status !== "ASSIGNED" && current.status !== "IN_PROGRESS") {
          throw new HttpError(
            409,
            "VISIT_DISTANCE_NOT_AVAILABLE",
            "Проверить километраж можно после назначения мастера и до диагностики.",
          );
        }
        const now = new Date();
        const updated = await transaction.repairOrder.update({
          where: { id: orderId },
          data: {
            visitIsWithinCity: isWithinCity,
            visitVerifiedDistanceKm: distanceKm,
            visitDistanceVerifiedAt: now,
            visitDistanceVerifiedById: user.id,
          },
        });
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: current.status,
            to: current.status,
            note: isWithinCity
              ? "Адрес проверен по Яндекс Картам: в пределах Пушкино, выезд бесплатный"
              : `Расстояние проверено по Яндекс Картам: ${distanceKm} км в одну сторону от границы Пушкино`,
          },
        });
        return updated;
      });
      response.json({ order });
    },
  );

  router.post(
    "/orders/:orderId/visit-pickup",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: pickupBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            customerId: true,
            assignedTechnicianId: true,
            status: true,
            repairLocation: true,
            visitScenarioVersion: true,
            visitPickupAgreedAt: true,
          },
        });
        if (!current || current.assignedTechnicianId !== user.id) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          current.visitScenarioVersion < 1 ||
          current.repairLocation !== "CUSTOMER_ADDRESS" ||
          current.visitPickupAgreedAt
        ) {
          throw new HttpError(
            409,
            "VISIT_PICKUP_NOT_AVAILABLE",
            "Для этой заявки нельзя оформить передачу техники в сервис.",
          );
        }
        if (current.status !== "ASSIGNED" && current.status !== "IN_PROGRESS") {
          throw new HttpError(
            409,
            "VISIT_PICKUP_NOT_AVAILABLE",
            "Заявка уже не находится на этапе выезда.",
          );
        }
        const intake = await transaction.repairOrderIntake.findUnique({
          where: { orderId },
          select: { conditionSummary: true, intakeMediaObjectId: true },
        });
        if (!intake?.conditionSummary.trim() || !intake.intakeMediaObjectId) {
          throw new HttpError(
            409,
            "VISIT_INTAKE_REQUIRED",
            "Перед перевозкой зафиксируйте состояние и комплектность техники и добавьте одно фото или видео.",
          );
        }
        const updated = await transaction.repairOrder.update({
          where: { id: orderId },
          data: {
            repairLocation: "SERVICE_CENTER",
            visitPickupAgreedAt: new Date(),
          },
        });
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: current.status,
            to: current.status,
            note: "Клиент согласился на перевозку техники в сервис; состояние и комплектность зафиксированы",
          },
        });
        return updated;
      });
      response.json({ order });
    },
  );

  router.post(
    "/orders/:orderId/onsite-completion",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: onsiteCompletionBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof onsiteCompletionBody>>(response);
      const user = getAuthenticatedUser(response);
      const result = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: {
            items: { orderBy: { createdAt: "asc" } },
            estimates: { select: { status: true } },
            receipt: true,
            salaryEntry: true,
            warranty: true,
            customer: { select: { displayName: true, phoneNumber: true } },
          },
        });
        if (!order || order.assignedTechnicianId !== user.id) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          order.visitScenarioVersion < 1 ||
          order.repairLocation !== "CUSTOMER_ADDRESS" ||
          order.visitPickupAgreedAt ||
          !["ASSIGNED", "IN_PROGRESS"].includes(order.status) ||
          order.receipt
        ) {
          throw new HttpError(
            409,
            "ONSITE_REPAIR_NOT_AVAILABLE",
            "Заявка уже не находится на этапе самостоятельного ремонта у клиента.",
          );
        }
        if (
          order.items.length > 0 ||
          order.estimates.length > 0 ||
          order.salaryEntry
        ) {
          throw new HttpError(
            409,
            "ONSITE_REPAIR_HAS_SERVICE_WORKFLOW",
            "Для этой заявки уже начато согласование работ в сервисе; завершите её по обычному порядку.",
          );
        }
        if (
          order.diagnosisCompletedAt &&
          order.visitIsWithinCity === false &&
          (order.visitVerifiedDistanceKm === null ||
            !order.visitDistanceVerifiedAt)
        ) {
          throw new HttpError(
            409,
            "VISIT_DISTANCE_NOT_VERIFIED",
            "Сначала подтвердите километраж по Яндекс Картам.",
          );
        }
        if (!input.repairAgreed && !order.diagnosisCompletedAt) {
          throw new HttpError(
            409,
            "DIAGNOSIS_REQUIRED_FOR_DECLINED_REPAIR",
            "Зафиксируйте завершённую диагностику перед оформлением отказа от ремонта.",
          );
        }

        const now = new Date();
        const repairItem = input.repairAgreed
          ? await transaction.repairOrderItem.create({
              data: {
                orderId,
                type: "SERVICE",
                name: "Ремонт на выезде",
                quantity: 1,
                unitPriceRub: input.repairPriceRub,
                addedById: user.id,
              },
            })
          : null;
        const allItems = repairItem
          ? [...order.items, repairItem]
          : order.items;
        const serviceTotalRub = calculateServiceBonusEligibleRub(allItems);
        const visitFeesRub = order.diagnosisFeeRub + order.visitFeeRub;
        const totalRub =
          serviceTotalRub +
          allItems
            .filter((item) => item.type !== "SERVICE")
            .reduce((sum, item) => sum + item.quantity * item.unitPriceRub, 0) +
          visitFeesRub;
        if (totalRub > 2_147_483_647) {
          throw new HttpError(
            400,
            "ORDER_TOTAL_TOO_LARGE",
            "Итог заказа превышает допустимое значение.",
          );
        }
        const itemsSnapshot = [
          ...allItems.map((item) => ({
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
        ] as Prisma.InputJsonValue;
        const receipt = await transaction.repairReceipt.create({
          data: {
            orderId,
            receiptNumber: `DOC-${order.serviceNumber}`,
            serviceNumber: order.serviceNumber,
            customerName: order.customer.displayName,
            customerPhone: order.contactPhone ?? order.customer.phoneNumber,
            issuedById: user.id,
            itemsSnapshot,
            totalRub,
            bonusDiscountRub: 0,
            paymentStatus: "PAID",
            paymentMethod: input.paymentMethod,
            paidAt: now,
            issuedAt: now,
          },
        });
        const technician = await transaction.user.findUnique({
          where: { id: user.id },
          select: { salaryRatePercent: true },
        });
        const ratePercent =
          technician?.salaryRatePercent ?? TECHNICIAN_SALARY_RATE_PERCENT;
        const salaryEntry = await transaction.technicianSalaryEntry.create({
          data: {
            orderId,
            technicianId: user.id,
            serviceTotalRub,
            visitFeesRub,
            salaryRub:
              calculateTechnicianSalaryRub(serviceTotalRub, ratePercent) +
              visitFeesRub,
            ratePercent,
            earnedAt: now,
          },
        });
        const statusUpdate = await transaction.repairOrder.updateMany({
          where: { id: orderId, status: order.status },
          data: {
            status: "COMPLETED",
            onsiteRepairCompletedAt: now,
            bonusDiscountRub: 0,
            redeemBonuses: false,
          },
        });
        if (statusUpdate.count !== 1) {
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
            from: order.status,
            to: "COMPLETED",
            note: input.repairAgreed
              ? `Мастер согласовал и завершил ремонт на выезде; оплата: ${input.paymentMethod === "CASH" ? "наличные" : "перевод"}; ${totalRub} ₽`
              : `Клиент отказался от ремонта после диагностики; мастер принял оплату: ${input.paymentMethod === "CASH" ? "наличные" : "перевод"}; ${totalRub} ₽`,
          },
        });
        if (input.repairAgreed) {
          const scheduledAt = getRepairFollowUpScheduledAt(now);
          await transaction.repairOrderFollowUp.create({
            data: { orderId, scheduledAt, nextAttemptAt: scheduledAt },
          });
        }
        const warranty = input.repairAgreed
          ? (order.warranty ??
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
            })))
          : null;
        const earnedPoints =
          input.paymentMethod === "CASH"
            ? calculateEarnedPoints(serviceTotalRub)
            : 0;
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
        if (input.repairAgreed) {
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
        return { order: savedOrder, receipt, warranty, salaryEntry };
      });
      await sendRepairOrderNotification(
        database,
        result.order,
        user.id,
        `Мастер завершил ремонт на выезде по заявке ${result.order.serviceNumber}.`,
        "Ремонт завершён",
      );
      response.json(result);
    },
  );

  return router;
};
