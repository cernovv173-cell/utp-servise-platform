import { Router } from "express";
import { z } from "zod";

import type { UserRole } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { isInventoryCatalogItem } from "../catalog/catalog-policy.js";
import {
  isSupportedRepairDeviceType,
  storedRepairDeviceTypes,
  supportedRepairDeviceTypes,
} from "../catalog/repair-device-types.js";
import { assertRepairOrderIntakeOpen } from "../company/repair-order-intake.js";
import { scheduleMaxRepairNotification } from "../max/max-notifications.js";
import {
  sendRepairOrderNotification,
  sendRepairOrderNotificationForId,
} from "../notifications/push-notifications.js";
import { awardReferralForFirstPaidRepair } from "../referrals/referral-rewards.js";
import {
  TECHNICIAN_SALARY_RATE_PERCENT,
  calculateTechnicianSalaryRub,
} from "../salary/salary-calculation.js";
import { scheduleTelegramRepairNotification } from "../telegram/telegram-notifications.js";
import {
  calculateEarnedPoints,
  calculateMaxBonusDiscount,
  calculateServiceBonusEligibleRub,
  canAddRepairOrderItem,
  canManageRepairOrderBonusRedemption,
  canTransitionRepairStatus,
  canViewRepairOrder,
} from "./order-policy.js";
import {
  addressFromFields,
  assertRepairOrderScenarioIsComplete,
  repairOrderContactPhone as contactPhone,
  createAdminOrderBody,
  createOrderBody,
  createRepairOrderWithinTransaction,
} from "./repair-order-intake.js";
import { createRepairOrderReleaseRouter } from "./repair-order-release.routes.js";
import { createRepairReviewRequestRouter } from "./repair-review-request.routes.js";
import { createRepairTechnicianCompletionRouter } from "./repair-technician-completion.routes.js";
import {
  REPAIR_DIAGNOSIS_FEE_RUB,
  calculateRepairVisitFeeRub,
  isActiveOnsiteRepairOrder,
} from "./repair-visit-policy.js";
import { createRepairVisitRouter } from "./repair-visits.routes.js";
import { assertWorkActApproved } from "./repair-work-act.shared.js";
import {
  REPAIR_WARRANTY_DAYS,
  REPAIR_WARRANTY_TERMS,
  getRepairWarrantyExpiresAt,
} from "./warranty-policy.js";

const orderIdParams = z.object({ orderId: z.string().uuid() });
const orderListQuery = z
  .object({
    archive: z.enum(["active", "archived"]).optional(),
    scope: z.enum(["personal", "business"]).optional(),
  })
  .strict();
const orderSearchQuery = z
  .object({
    serviceNumber: z.string().trim().min(2).max(32),
    scope: z.enum(["personal", "business"]).optional(),
  })
  .strict();
const orderItemParams = z.object({
  orderId: z.string().uuid(),
  itemId: z.string().uuid(),
});
const reviewIdParams = z.object({ reviewId: z.string().uuid() });
const moderateReviewBody = z.object({ isPublished: z.boolean() }).strict();
const warrantyClaimBody = z
  .object({
    problem: z.string().trim().min(5).max(1800),
    preferredAt: z.string().datetime({ offset: true }).nullable().optional(),
  })
  .strict();
const editOrderBody = z
  .object({
    deviceType: z.enum(storedRepairDeviceTypes).optional(),
    deviceBrand: z.string().trim().max(120).optional(),
    deviceModel: z.string().trim().max(160).optional(),
    deviceSerialNumber: z.string().trim().max(160).optional(),
    problem: z.string().trim().min(5).max(2000).optional(),
    address: z.string().trim().max(500).optional(),
    contactPhone: contactPhone.optional(),
    city: z.string().trim().min(2).max(120).optional(),
    street: z.string().trim().min(2).max(180).optional(),
    house: z.string().trim().min(1).max(30).optional(),
    apartment: z.string().trim().max(30).optional(),
    entrance: z.string().trim().max(30).optional(),
    hasBarrier: z.boolean().optional(),
    floor: z.string().trim().max(20).optional(),
    additionalPhone: z.string().trim().max(32).optional(),
    additionalInfo: z.string().trim().max(500).optional(),
    preferredAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);
const statusBody = z
  .object({
    status: z.enum(["IN_PROGRESS", "READY_FOR_PICKUP", "CANCELLED"]),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
const intakeBody = z
  .object({
    conditionSummary: z.string().trim().min(2).max(3000),
    serialNumber: z.string().trim().max(160).optional(),
    includedAccessories: z.string().trim().max(1000).optional(),
    intakeNotes: z.string().trim().max(2000).optional(),
  })
  .strict();
const expectedCompletionBody = z
  .object({
    expectedCompletionAt: z.string().datetime({ offset: true }).nullable(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
const bonusRedemptionBody = z.object({ redeemBonuses: z.boolean() }).strict();
const receiptPaymentBody = z
  .object({
    paymentMethod: z.enum(["CASH", "CARD_TERMINAL", "BANK_TRANSFER", "OTHER"]),
  })
  .strict();
const receiptDraftBody = z
  .object({
    itemQuantities: z
      .array(
        z
          .object({
            itemId: z.string().uuid(),
            quantity: z.number().int().min(0).max(99),
          })
          .strict(),
      )
      .max(100)
      .optional(),
    freeSaleItems: z
      .array(
        z
          .object({
            type: z.enum(["SERVICE", "SPARE_PART", "PRODUCT"]),
            name: z.string().trim().min(1).max(160),
            quantity: z.number().int().min(1).max(99),
            unitPriceRub: z.number().int().min(1).max(2_147_483_647),
          })
          .strict(),
      )
      .max(50)
      .optional(),
  })
  .strict()
  .superRefine((body, context) => {
    const itemIds = body.itemQuantities?.map((item) => item.itemId) ?? [];
    if (new Set(itemIds).size !== itemIds.length) {
      context.addIssue({
        code: "custom",
        message: "Each order item can be updated only once.",
        path: ["itemQuantities"],
      });
    }
  })
  .optional();
const receiptItems = z.array(
  z.object({
    name: z.string(),
    quantity: z.number().int(),
    unitPriceRub: z.number().int(),
    totalRub: z.number().int(),
  }),
);
const assignBody = z.object({ technicianId: z.string().uuid() }).strict();
const orderItemBody = z
  .object({
    catalogItemId: z.string().uuid(),
    quantity: z.number().int().min(1).max(99),
  })
  .strict();
const orderItemQuantityBody = z
  .object({ quantity: z.number().int().min(1).max(99) })
  .strict();
const reviewBody = z
  .object({
    orderId: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().trim().min(3).max(2000),
  })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const orderDetails = (role: UserRole) => ({
  businessProfile: {
    select: { id: true, companyName: true },
  },
  warrantyOriginOrder: {
    select: { id: true, serviceNumber: true },
  },
  customer: {
    select: {
      id: true,
      displayName: true,
      avatarObjectId: true,
      phoneNumber: role === "TECHNICIAN" || role === "ADMIN",
    },
  },
  assignedTechnician: {
    select: {
      id: true,
      displayName: true,
      avatarObjectId: true,
      phoneNumber: role === "CUSTOMER" || role === "ADMIN",
    },
  },
  statusEvents: {
    orderBy: { createdAt: "desc" as const },
    select: {
      from: true,
      to: true,
      note: true,
      createdAt: true,
      actor: { select: { id: true, displayName: true, role: true } },
    },
  },
  items: {
    orderBy: { createdAt: "asc" as const },
    include: { addedBy: { select: { id: true, displayName: true } } },
  },
  estimates: {
    orderBy: { version: "asc" as const },
    include: { createdBy: { select: { id: true, displayName: true } } },
  },
  ...(role === "CUSTOMER"
    ? {}
    : {
        workAct: {
          include: {
            createdBy: { select: { id: true, displayName: true } },
            approvedBy: { select: { id: true, displayName: true } },
          },
        },
      }),
  deadlineChanges: {
    orderBy: { createdAt: "desc" as const },
    include: { actor: { select: { id: true, displayName: true } } },
  },
  photos: {
    orderBy: { createdAt: "asc" as const },
    select: {
      id: true,
      objectId: true,
      createdAt: true,
      portfolioConsentAt: true,
      createdBy: { select: { displayName: true } },
    },
  },
  intake: {
    select: {
      id: true,
      orderId: true,
      frontCondition: true,
      frontPhotoObjectId: true,
      backCondition: true,
      backPhotoObjectId: true,
      leftCondition: true,
      leftPhotoObjectId: true,
      rightCondition: true,
      rightPhotoObjectId: true,
      conditionSummary: true,
      intakeMediaObjectId: true,
      intakeMediaType: true,
      serialNumber: true,
      includedAccessories: true,
      intakeNotes: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  warranty: {
    select: {
      id: true,
      orderId: true,
      warrantyNumber: true,
      customerName: true,
      deviceType: true,
      repairSummary: true,
      warrantyDays: true,
      terms: true,
      issuedAt: true,
      expiresAt: true,
    },
  },
  review: true,
  receipt: true,
});

const getOrdersRoleWhere = async (
  database: DatabaseClient,
  user: { id: string; role: UserRole },
  scope?: "personal" | "business",
) => {
  if (user.role === "CUSTOMER") {
    if (scope === "business") {
      const profile = await database.customerBusinessProfile.findUnique({
        where: { ownerUserId: user.id },
        select: { id: true },
      });
      return profile
        ? { customerId: user.id, businessProfileId: profile.id }
        : null;
    }
    return { customerId: user.id, businessProfileId: null };
  }
  if (scope) {
    throw new HttpError(
      400,
      "ORDER_SCOPE_CUSTOMER_ONLY",
      "Область заявок доступна только клиентскому аккаунту.",
    );
  }
  return user.role === "TECHNICIAN" ? { assignedTechnicianId: user.id } : {};
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createOrdersRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/orders",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    validateRequest({ query: orderListQuery }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { archive, scope } = (
        response.locals.input as {
          readonly query: z.infer<typeof orderListQuery>;
        }
      ).query;
      const roleWhere = await getOrdersRoleWhere(database, user, scope);
      if (!roleWhere) {
        response.json({ orders: [] });
        return;
      }
      const archiveWhere =
        archive === "active"
          ? { archivedAt: null }
          : archive === "archived"
            ? { archivedAt: { not: null } }
            : {};
      const orders = await database.repairOrder.findMany({
        where: { ...roleWhere, ...archiveWhere },
        include: orderDetails(user.role),
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 100,
      });
      response.json({ orders });
    },
  );

  router.get(
    "/orders/search",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    validateRequest({ query: orderSearchQuery }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const query = (
        response.locals.input as {
          readonly query: z.infer<typeof orderSearchQuery>;
        }
      ).query;
      const roleWhere = await getOrdersRoleWhere(database, user, query.scope);
      if (!roleWhere) {
        response.json({ orders: [] });
        return;
      }
      const orders = await database.repairOrder.findMany({
        where: {
          ...roleWhere,
          serviceNumber: { contains: query.serviceNumber, mode: "insensitive" },
        },
        include: orderDetails(user.role),
        orderBy: { createdAt: "desc" },
        take: 50,
      });
      response.json({ orders });
    },
  );

  router.get(
    "/admin/orders/:orderId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: orderIdParams }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        include: orderDetails("ADMIN"),
      });
      if (!order)
        throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
      response.json({ order });
    },
  );

  router.post(
    "/orders",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: createOrderBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createOrderBody>>(response);
      assertRepairOrderScenarioIsComplete(input);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${user.id}::uuid FOR UPDATE
        `;
        await assertRepairOrderIntakeOpen(transaction);
        const businessProfile = input.businessOrder
          ? await transaction.customerBusinessProfile.findUnique({
              where: { ownerUserId: user.id },
              select: { id: true },
            })
          : null;
        if (input.businessOrder && !businessProfile) {
          throw new HttpError(
            404,
            "BUSINESS_PROFILE_NOT_FOUND",
            "Сначала создайте профиль компании.",
          );
        }
        const businessProfileId = businessProfile?.id ?? null;
        const savedDevice = input.customerDeviceId
          ? await transaction.customerDevice.findFirst({
              where: {
                id: input.customerDeviceId,
                customerId: user.id,
                businessProfileId,
              },
            })
          : null;
        if (input.customerDeviceId && !savedDevice) {
          throw new HttpError(404, "DEVICE_NOT_FOUND", "Техника не найдена.");
        }
        if (
          savedDevice &&
          !isSupportedRepairDeviceType(savedDevice.deviceType)
        ) {
          throw new HttpError(
            400,
            "UNSUPPORTED_REPAIR_DEVICE_TYPE",
            "Новые заявки принимаются только на компьютеры и ноутбуки.",
          );
        }
        const created = await createRepairOrderWithinTransaction(transaction, {
          actorId: user.id,
          customerId: user.id,
          contactPhone: input.contactPhone,
          input,
          statusNote: "Заявка создана",
          businessProfileId,
          savedDevice: savedDevice
            ? {
                id: savedDevice.id,
                deviceType:
                  savedDevice.deviceType as (typeof supportedRepairDeviceTypes)[number],
                brand: savedDevice.brand,
                model: savedDevice.model,
                serialNumber: savedDevice.serialNumber,
              }
            : null,
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: created.id },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Создана новая заявка на ремонт.",
      );
      response.status(201).json({ order });
    },
  );

  router.post(
    "/orders/:orderId/warranty-claims",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: orderIdParams, body: warrantyClaimBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof warrantyClaimBody>>(response);
      const order = await database.$transaction(async (transaction) => {
        const source = await transaction.repairOrder.findFirst({
          where: { id: orderId, customerId: user.id },
          include: {
            warranty: {
              select: { warrantyNumber: true, expiresAt: true },
            },
          },
        });
        if (!source)
          throw new HttpError(
            404,
            "ORDER_NOT_FOUND",
            "Исходный ремонт не найден.",
          );
        if (
          source.status !== "COMPLETED" ||
          !source.warranty ||
          source.warranty.expiresAt <= new Date()
        ) {
          throw new HttpError(
            409,
            "WARRANTY_NOT_ACTIVE",
            "По этому ремонту нет действующего гарантийного талона.",
          );
        }

        const sequence = await transaction.$queryRaw<Array<{ value: bigint }>>`
          SELECT nextval('repair_service_number_seq') AS value
        `;
        const number = String(sequence[0]?.value ?? "1").padStart(6, "0");
        const additionalInfo = [
          `Гарантийное обращение по талону ${source.warranty.warrantyNumber}.`,
          `Исходный ремонт ${source.serviceNumber}.`,
          source.additionalInfo,
        ]
          .filter(Boolean)
          .join(" ")
          .slice(0, 500);
        const created = await transaction.repairOrder.create({
          data: {
            serviceNumber: `SRV-${new Date().getUTCFullYear()}-${number}`,
            customerId: user.id,
            businessProfileId: source.businessProfileId,
            workActRequired: true,
            customerDeviceId: source.customerDeviceId,
            warrantyOriginOrderId: source.id,
            deviceType: source.deviceType,
            deviceBrand: source.deviceBrand,
            deviceModel: source.deviceModel,
            deviceSerialNumber: source.deviceSerialNumber,
            problem: input.problem,
            address: source.address,
            contactPhone: source.contactPhone,
            city: source.city,
            street: source.street,
            house: source.house,
            apartment: source.apartment,
            entrance: source.entrance,
            hasBarrier: source.hasBarrier,
            floor: source.floor,
            additionalPhone: source.additionalPhone,
            additionalInfo,
            preferredAt: input.preferredAt ? new Date(input.preferredAt) : null,
          },
        });
        await transaction.repairStatusEvent.create({
          data: {
            orderId: created.id,
            actorId: user.id,
            from: null,
            to: "REQUESTED",
            note: `Гарантийное обращение по талону ${source.warranty.warrantyNumber}; исходный ремонт ${source.serviceNumber}`,
          },
        });
        const chat = await transaction.orderChat.create({
          data: {
            orderId: created.id,
            adminRequestedAt: new Date(),
            adminRequestedById: user.id,
          },
          select: { id: true },
        });
        await transaction.orderChatMessage.create({
          data: {
            chatId: chat.id,
            senderId: user.id,
            content: input.problem,
          },
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: created.id },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        `Новое гарантийное обращение по ремонту ${order.serviceNumber}.`,
      );
      response.status(201).json({ order });
    },
  );

  router.post(
    "/admin/orders",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: createAdminOrderBody }),
    async (_request, response) => {
      const administrator = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createAdminOrderBody>>(response);
      assertRepairOrderScenarioIsComplete(input);
      const customer = await database.user.findFirst({
        where: { id: input.customerId, role: "CUSTOMER", active: true },
        select: {
          id: true,
          email: true,
          login: true,
          maxUserId: true,
          phoneNumber: true,
        },
      });
      if (!customer) {
        throw new HttpError(
          404,
          "CUSTOMER_NOT_FOUND",
          "Активный клиент не найден.",
        );
      }
      const contactPhone = input.contactPhone?.trim() || customer.phoneNumber;
      if (!contactPhone || (contactPhone.match(/\d/g)?.length ?? 0) < 7) {
        throw new HttpError(
          400,
          "CUSTOMER_PHONE_REQUIRED",
          "Укажите телефон для связи по заявке.",
        );
      }

      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${customer.id}::uuid FOR UPDATE
        `;
        const created = await createRepairOrderWithinTransaction(transaction, {
          actorId: administrator.id,
          customerId: customer.id,
          contactPhone,
          input,
          statusNote: "Заявка создана администратором",
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: created.id },
          include: orderDetails("ADMIN"),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        administrator.id,
        "Создана новая заявка на ремонт.",
      );
      response.status(201).json({ order });
    },
  );

  router.patch(
    "/orders/:orderId",
    requireAuth,
    requireRoles("CUSTOMER", "ADMIN"),
    validateRequest({ params: orderIdParams, body: editOrderBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof editOrderBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            customerId: true,
            assignedTechnicianId: true,
            deviceType: true,
            status: true,
            updatedAt: true,
            city: true,
            street: true,
            house: true,
            apartment: true,
            entrance: true,
            hasBarrier: true,
            floor: true,
            additionalInfo: true,
          },
        });
        if (!current || !canViewRepairOrder(user.role, user.id, current)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        const editableStatus = current.status === "REQUESTED";
        if (!editableStatus) {
          throw new HttpError(
            409,
            "ORDER_NOT_EDITABLE",
            "Данные заявки можно менять только на этапе приёма, до начала ремонта.",
          );
        }
        if (
          input.deviceType !== undefined &&
          input.deviceType !== current.deviceType &&
          (!isSupportedRepairDeviceType(current.deviceType) ||
            !isSupportedRepairDeviceType(input.deviceType))
        ) {
          throw new HttpError(
            400,
            "UNSUPPORTED_REPAIR_DEVICE_TYPE",
            "Новые заявки принимаются только на компьютеры и ноутбуки; тип ранее созданной заявки сохраняется.",
          );
        }
        const addressFieldsChanged = [
          input.city,
          input.street,
          input.house,
          input.apartment,
          input.entrance,
          input.hasBarrier,
          input.floor,
          input.additionalInfo,
        ].some((value) => value !== undefined);
        const address =
          input.address ??
          (addressFieldsChanged
            ? addressFromFields({
                city: input.city ?? current.city,
                street: input.street ?? current.street,
                house: input.house ?? current.house,
                apartment: input.apartment ?? current.apartment,
                entrance: input.entrance ?? current.entrance,
                hasBarrier: input.hasBarrier ?? current.hasBarrier,
                floor: input.floor ?? current.floor,
                additionalInfo: input.additionalInfo ?? current.additionalInfo,
              })
            : undefined);
        const update = await transaction.repairOrder.updateMany({
          where: {
            id: current.id,
            status: current.status,
            updatedAt: current.updatedAt,
          },
          data: {
            deviceType: input.deviceType,
            deviceBrand: input.deviceBrand,
            deviceModel: input.deviceModel,
            deviceSerialNumber: input.deviceSerialNumber,
            problem: input.problem,
            address,
            contactPhone: input.contactPhone,
            city: input.city,
            street: input.street,
            house: input.house,
            apartment: input.apartment,
            entrance: input.entrance,
            hasBarrier: input.hasBarrier,
            floor: input.floor,
            additionalPhone: input.additionalPhone,
            additionalInfo: input.additionalInfo,
            preferredAt:
              input.preferredAt === undefined
                ? undefined
                : input.preferredAt
                  ? new Date(input.preferredAt)
                  : null,
          },
        });
        if (update.count !== 1) {
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        }
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Изменены данные заявки на ремонт.",
      );
      response.json({ order });
    },
  );

  router.patch(
    "/orders/:orderId/expected-completion",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: expectedCompletionBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { expectedCompletionAt, note } =
        bodyOf<z.infer<typeof expectedCompletionBody>>(response);
      const user = getAuthenticatedUser(response);
      const nextExpectedAt = expectedCompletionAt
        ? new Date(expectedCompletionAt)
        : null;
      const result = await database.$transaction(async (transaction) => {
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            expectedCompletionAt: true,
            assignedTechnicianId: true,
            status: true,
          },
        });
        if (!current) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (current.assignedTechnicianId !== user.id) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          !["ASSIGNED", "IN_PROGRESS", "READY_FOR_PICKUP"].includes(
            current.status,
          )
        ) {
          throw new HttpError(
            409,
            "DEADLINE_NOT_EDITABLE",
            "Срок готовности меняет назначенный мастер до закрытия заявки.",
          );
        }

        const hasChanged =
          current.expectedCompletionAt?.getTime() !== nextExpectedAt?.getTime();
        if (hasChanged) {
          const update = await transaction.repairOrder.updateMany({
            where: {
              id: orderId,
              expectedCompletionAt: current.expectedCompletionAt,
            },
            data: { expectedCompletionAt: nextExpectedAt },
          });
          if (update.count !== 1) {
            throw new HttpError(
              409,
              "ORDER_CHANGED",
              "Срок уже изменился. Обновите заявку и повторите действие.",
            );
          }
          await transaction.repairOrderDeadlineChange.create({
            data: {
              orderId,
              actorId: user.id,
              previousExpectedAt: current.expectedCompletionAt,
              expectedCompletionAt: nextExpectedAt,
              note: note || null,
            },
          });
        }

        return {
          hasChanged,
          order: await transaction.repairOrder.findUniqueOrThrow({
            where: { id: orderId },
            include: orderDetails(user.role),
          }),
        };
      });
      if (result.hasChanged) {
        const scheduledDate = nextExpectedAt
          ? nextExpectedAt.toLocaleString("ru-RU", {
              timeZone: "Europe/Moscow",
            })
          : "не указан";
        const message = [
          `Плановый срок готовности изменён: ${scheduledDate}.`,
          note ? `Пояснение сервиса: ${note}` : null,
        ]
          .filter(Boolean)
          .join(" ");
        await sendRepairOrderNotification(
          database,
          result.order,
          user.id,
          message,
        );
      }
      response.json({ order: result.order });
    },
  );

  router.patch(
    "/orders/:orderId/bonus-redemption",
    requireAuth,
    requireRoles("TECHNICIAN", "ADMIN"),
    validateRequest({ params: orderIdParams, body: bonusRedemptionBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const user = getAuthenticatedUser(response);
      const { redeemBonuses } =
        bodyOf<z.infer<typeof bonusRedemptionBody>>(response);
      const updated = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: { items: true, receipt: true },
        });
        if (!order)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (!canManageRepairOrderBonusRedemption(user.role, user.id, order)) {
          if (user.role === "ADMIN") {
            throw new HttpError(
              403,
              "BONUS_REDEMPTION_LOCATION_RESTRICTED",
              "Администратор может списывать бонусы только по ремонту в сервисном центре.",
            );
          }
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          order.status !== "COMPLETED" ||
          !order.receipt ||
          order.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "BONUS_REDEMPTION_CLOSED",
            "Бонусы можно списать только по завершённому ремонту с неоплаченным чеком.",
          );
        }
        const serviceTotalRub = calculateServiceBonusEligibleRub(order.items);
        const balance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: order.customerId },
          _sum: { points: true },
        });
        const bonusDiscountRub = redeemBonuses
          ? calculateMaxBonusDiscount(serviceTotalRub, balance._sum.points ?? 0)
          : 0;
        const saved = await transaction.repairOrder.update({
          where: { id: orderId },
          data: { redeemBonuses, bonusDiscountRub },
          include: orderDetails(user.role),
        });
        if (order.receipt) {
          await transaction.repairReceipt.update({
            where: { id: order.receipt.id },
            data: { bonusDiscountRub },
          });
        }
        return saved;
      });
      await sendRepairOrderNotification(
        database,
        updated,
        user.id,
        user.role === "ADMIN"
          ? "Администратор обновил списание бонусов за услуги по заявке."
          : "Мастер обновил списание бонусов за услуги по заявке.",
      );
      response.json({ order: updated });
    },
  );

  router.post(
    "/orders/:orderId/receipt",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: receiptDraftBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof receiptDraftBody>>(response) ?? {};
      const user = getAuthenticatedUser(response);
      const receipt = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: {
            items: { orderBy: { createdAt: "asc" } },
            customer: { select: { displayName: true, phoneNumber: true } },
            receipt: true,
            workAct: { select: { status: true } },
            salaryEntry: true,
          },
        });
        if (!order)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (order.assignedTechnicianId !== user.id) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (order.status !== "COMPLETED") {
          throw new HttpError(
            409,
            "ORDER_NOT_COMPLETED",
            "Документ по ремонту можно сформировать после завершения работ.",
          );
        }
        assertWorkActApproved(order.workActRequired, order.workAct?.status);
        if (order.receipt?.paymentStatus === "PAID") {
          throw new HttpError(
            409,
            "RECEIPT_ALREADY_PAID",
            "Оплаченный чек нельзя изменить.",
          );
        }

        const itemById = new Map(order.items.map((item) => [item.id, item]));
        const requestedItems = input.itemQuantities ?? [];
        if (requestedItems.some((item) => !itemById.has(item.itemId))) {
          throw new HttpError(
            400,
            "ORDER_ITEM_NOT_FOUND",
            "Одна или несколько позиций не принадлежат этой заявке.",
          );
        }

        const updatedItems = [...order.items];
        for (const requestedItem of requestedItems) {
          const currentItem = itemById.get(requestedItem.itemId)!;
          if (currentItem.quantity === requestedItem.quantity) continue;
          const quantityDelta = requestedItem.quantity - currentItem.quantity;
          if (
            quantityDelta > 0 &&
            isInventoryCatalogItem(currentItem.type) &&
            currentItem.catalogItemId
          ) {
            const stockUpdate = await transaction.repairCatalogItem.updateMany({
              where: {
                id: currentItem.catalogItemId,
                stockQuantity: { gte: quantityDelta },
              },
              data: { stockQuantity: { decrement: quantityDelta } },
            });
            if (stockUpdate.count !== 1) {
              throw new HttpError(
                409,
                currentItem.type === "PRODUCT"
                  ? "INSUFFICIENT_PRODUCT_STOCK"
                  : "INSUFFICIENT_SPARE_PART_STOCK",
                `Недостаточно ${currentItem.type === "PRODUCT" ? "товара" : "запчастей"} на складе для изменения количества.`,
              );
            }
          } else if (
            quantityDelta < 0 &&
            isInventoryCatalogItem(currentItem.type) &&
            currentItem.catalogItemId
          ) {
            await transaction.repairCatalogItem.updateMany({
              where: { id: currentItem.catalogItemId },
              data: { stockQuantity: { increment: -quantityDelta } },
            });
          }
          const index = updatedItems.findIndex(
            (item) => item.id === currentItem.id,
          );
          if (requestedItem.quantity === 0) {
            await transaction.repairOrderItem.delete({
              where: { id: currentItem.id },
            });
            if (index >= 0) updatedItems.splice(index, 1);
          } else {
            const updatedItem = await transaction.repairOrderItem.update({
              where: { id: currentItem.id },
              data: { quantity: requestedItem.quantity },
            });
            if (index >= 0) updatedItems[index] = updatedItem;
          }
        }

        for (const freeSaleItem of input.freeSaleItems ?? []) {
          updatedItems.push(
            await transaction.repairOrderItem.create({
              data: {
                orderId,
                catalogItemId: null,
                type: freeSaleItem.type,
                name: freeSaleItem.name,
                quantity: freeSaleItem.quantity,
                unitPriceRub: freeSaleItem.unitPriceRub,
                addedById: user.id,
              },
            }),
          );
        }

        const snapshot = updatedItems.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPriceRub: item.unitPriceRub,
          totalRub: item.quantity * item.unitPriceRub,
        }));
        const totalRub = snapshot.reduce(
          (total, item) => total + item.totalRub,
          0,
        );
        if (totalRub > 2_147_483_647) {
          throw new HttpError(
            400,
            "ORDER_TOTAL_TOO_LARGE",
            "Итог заказа превышает допустимое значение.",
          );
        }
        const balance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: order.customerId },
          _sum: { points: true },
        });
        const serviceTotalRub = calculateServiceBonusEligibleRub(updatedItems);
        const bonusDiscountRub = order.redeemBonuses
          ? calculateMaxBonusDiscount(serviceTotalRub, balance._sum.points ?? 0)
          : 0;
        await transaction.repairOrder.update({
          where: { id: orderId },
          data: { bonusDiscountRub },
        });
        if (order.salaryEntry) {
          const serviceTotalRub = updatedItems
            .filter((item) => item.type === "SERVICE")
            .reduce(
              (total, item) => total + item.quantity * item.unitPriceRub,
              0,
            );
          await transaction.technicianSalaryEntry.update({
            where: { id: order.salaryEntry.id },
            data: {
              serviceTotalRub,
              salaryRub: calculateTechnicianSalaryRub(
                serviceTotalRub,
                order.salaryEntry.ratePercent,
              ),
            },
          });
        }
        const data = {
          orderId,
          receiptNumber: `DOC-${order.serviceNumber}`,
          serviceNumber: order.serviceNumber,
          customerName: order.customer.displayName,
          customerPhone: order.contactPhone ?? order.customer.phoneNumber,
          issuedById: user.id,
          itemsSnapshot: snapshot,
          totalRub,
          bonusDiscountRub,
        };
        return order.receipt
          ? transaction.repairReceipt.update({
              where: { id: order.receipt.id },
              data: { ...data, issuedAt: new Date() },
            })
          : transaction.repairReceipt.create({ data });
      });
      await sendRepairOrderNotificationForId(
        database,
        orderId,
        user.id,
        "По заявке сформирован или обновлён расчётный документ.",
      );
      response.status(201).json({
        receipt: {
          ...receipt,
          itemsSnapshot: receiptItems.parse(receipt.itemsSnapshot),
        },
      });
    },
  );

  router.patch(
    "/orders/:orderId/receipt/payment",
    requireAuth,
    requireRoles("TECHNICIAN", "ADMIN"),
    validateRequest({ params: orderIdParams, body: receiptPaymentBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { paymentMethod } =
        bodyOf<z.infer<typeof receiptPaymentBody>>(response);
      const user = getAuthenticatedUser(response);
      const receipt = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const order = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          include: { receipt: true, items: true },
        });
        if (!order)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (!canManageRepairOrderBonusRedemption(user.role, user.id, order)) {
          if (user.role === "ADMIN") {
            throw new HttpError(
              403,
              "RECEIPT_PAYMENT_LOCATION_RESTRICTED",
              "Администратор может подтвердить оплату только по ремонту в сервисном центре.",
            );
          }
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (order.status !== "COMPLETED") {
          throw new HttpError(
            409,
            "ORDER_NOT_COMPLETED",
            "Подтвердить оплату можно только после завершения ремонта.",
          );
        }
        if (!order.receipt) {
          throw new HttpError(
            409,
            "RECEIPT_NOT_ISSUED",
            "Сначала сформируйте чек по завершённому ремонту.",
          );
        }
        await transaction.$queryRaw`
          SELECT "id" FROM "users" WHERE "id" = ${order.customerId}::uuid FOR UPDATE
        `;
        const currentReceipt =
          await transaction.repairReceipt.findUniqueOrThrow({
            where: { id: order.receipt.id },
          });
        if (currentReceipt.paymentStatus === "PAID") return currentReceipt;

        const balance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: order.customerId },
          _sum: { points: true },
        });
        const bonusDiscountRub = order.redeemBonuses
          ? calculateMaxBonusDiscount(
              calculateServiceBonusEligibleRub(order.items),
              balance._sum.points ?? 0,
            )
          : 0;
        const cashPaidRub = currentReceipt.totalRub - bonusDiscountRub;
        const markedPaid = await transaction.repairReceipt.updateMany({
          where: { id: currentReceipt.id, paymentStatus: "PENDING" },
          data: {
            paymentStatus: "PAID",
            paymentMethod,
            paidAt: new Date(),
            bonusDiscountRub,
          },
        });
        if (markedPaid.count !== 1) {
          throw new HttpError(
            409,
            "RECEIPT_PAYMENT_CHANGED",
            "Статус чека уже изменился. Обновите заявку.",
          );
        }
        await transaction.repairOrder.update({
          where: { id: order.id },
          data: { bonusDiscountRub },
        });
        if (bonusDiscountRub > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: order.customerId,
              orderId,
              actorId: user.id,
              type: "REDEEM",
              points: -bonusDiscountRub,
              reason: `Списание по оплаченному чеку ${currentReceipt.receiptNumber}`,
            },
          });
        }
        const earnedPoints = calculateEarnedPoints(cashPaidRub);
        if (earnedPoints > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: order.customerId,
              orderId,
              actorId: user.id,
              type: "EARN",
              points: earnedPoints,
              reason: `Начисление 10% по оплаченному чеку ${currentReceipt.receiptNumber}`,
            },
          });
        }
        await awardReferralForFirstPaidRepair(transaction, {
          inviteeId: order.customerId,
          orderId,
          serviceNumber: order.serviceNumber,
          actorId: user.id,
        });
        return transaction.repairReceipt.findUniqueOrThrow({
          where: { id: currentReceipt.id },
        });
      });
      await sendRepairOrderNotificationForId(
        database,
        orderId,
        user.id,
        "По заявке обновлён статус оплаты.",
      );
      response.json({
        receipt: {
          ...receipt,
          itemsSnapshot: receiptItems.parse(receipt.itemsSnapshot),
        },
      });
    },
  );

  router.patch(
    "/orders/:orderId/assign",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({
      params: orderIdParams,
      body: assignBody,
    }),
    async (_request, response, next) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { technicianId } = bodyOf<z.infer<typeof assignBody>>(response);
      const admin = getAuthenticatedUser(response);
      const technician = await database.user.findUnique({
        where: { id: technicianId },
      });
      if (
        !technician ||
        technician.role !== "TECHNICIAN" ||
        !technician.active
      ) {
        next(
          new HttpError(
            400,
            "INVALID_TECHNICIAN",
            "Выберите активного мастера.",
          ),
        );
        return;
      }
      const order = await database.$transaction(async (transaction) => {
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
        });
        if (!current)
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        const isEmergencyReassignment =
          current.assignedTechnicianId === null &&
          ["ASSIGNED", "IN_PROGRESS", "READY_FOR_PICKUP"].includes(
            current.status,
          );
        if (current.status !== "REQUESTED" && !isEmergencyReassignment) {
          throw new HttpError(
            409,
            "ORDER_NOT_ASSIGNABLE",
            "Мастера назначают при первичном приёме; заменить можно только мастера, уже снятого с заявки.",
          );
        }
        const nextStatus =
          current.status === "REQUESTED" ? "ASSIGNED" : current.status;
        const update = await transaction.repairOrder.updateMany({
          where: {
            id: current.id,
            status: current.status,
            assignedTechnicianId: current.assignedTechnicianId,
          },
          data: { assignedTechnicianId: technicianId, status: nextStatus },
        });
        if (update.count !== 1)
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: admin.id,
            from: current.status,
            to: nextStatus,
            note: isEmergencyReassignment
              ? `Назначен новый мастер после освобождения заявки: ${technician.displayName}`
              : `Назначен мастер: ${technician.displayName}`,
          },
        });
        if (current.status === "REQUESTED" && nextStatus === "ASSIGNED") {
          await scheduleTelegramRepairNotification(transaction, {
            orderId,
            userId: current.customerId,
            type: "DEVICE_ACCEPTED",
          });
          await scheduleMaxRepairNotification(transaction, {
            orderId,
            userId: current.customerId,
            type: "DEVICE_ACCEPTED",
          });
        }
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(admin.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        admin.id,
        "К заявке назначен мастер.",
      );
      response.json({ order });
    },
  );

  router.put(
    "/orders/:orderId/intake",
    requireAuth,
    requireRoles("TECHNICIAN", "ADMIN"),
    validateRequest({ params: orderIdParams, body: intakeBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof intakeBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.repairOrder.findUnique({
        where: { id: orderId },
        select: {
          id: true,
          customerId: true,
          assignedTechnicianId: true,
          status: true,
        },
      });
      if (!order || !canViewRepairOrder(user.role, user.id, order)) {
        throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
      }
      if (user.role === "ADMIN" && order.status !== "REQUESTED") {
        throw new HttpError(
          403,
          "INTAKE_ADMIN_ONLY",
          "Администратор заполняет акт только до передачи заявки мастеру.",
        );
      }
      if (
        ["READY_FOR_PICKUP", "COMPLETED", "CANCELLED"].includes(order.status)
      ) {
        throw new HttpError(
          409,
          "INTAKE_LOCKED",
          "Акт приёма нельзя изменять после завершения ремонта.",
        );
      }
      const intakeData = {
        ...input,
        serialNumber: input.serialNumber || null,
        includedAccessories: input.includedAccessories || "",
        intakeNotes: input.intakeNotes || "",
        updatedById: user.id,
      };
      const intake = await database.repairOrderIntake.upsert({
        where: { orderId },
        create: {
          orderId,
          ...intakeData,
          createdById: user.id,
        },
        update: intakeData,
      });
      response.json({ intake });
    },
  );

  router.post(
    "/orders/:orderId/diagnosis-completed",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams }),
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
            diagnosisCompletedAt: true,
            repairLocation: true,
            visitScenarioVersion: true,
            visitIsWithinCity: true,
            visitVerifiedDistanceKm: true,
            visitDistanceVerifiedAt: true,
          },
        });
        if (!current || current.assignedTechnicianId !== user.id) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (current.diagnosisCompletedAt) {
          return transaction.repairOrder.findUniqueOrThrow({
            where: { id: orderId },
            include: orderDetails(user.role),
          });
        }
        if (current.status !== "ASSIGNED" && current.status !== "IN_PROGRESS") {
          throw new HttpError(
            409,
            "DIAGNOSIS_NOT_AVAILABLE",
            "Завершить диагностику можно только после назначения мастера и до выдачи устройства.",
          );
        }

        if (
          current.visitScenarioVersion > 0 &&
          current.repairLocation === "CUSTOMER_ADDRESS" &&
          !current.visitDistanceVerifiedAt
        ) {
          throw new HttpError(
            409,
            "VISIT_DISTANCE_NOT_VERIFIED",
            "Перед завершением диагностики мастер должен сверить адрес и расстояние по Яндекс Картам.",
          );
        }

        const now = new Date();
        const diagnosisFeeRub =
          current.visitScenarioVersion > 0 ? REPAIR_DIAGNOSIS_FEE_RUB : 0;
        const visitFeeRub = calculateRepairVisitFeeRub({
          visitScenarioVersion: current.visitScenarioVersion,
          repairLocation: current.repairLocation,
          isWithinCity: current.visitIsWithinCity,
          verifiedDistanceKm: current.visitVerifiedDistanceKm,
          diagnosisCompleted: true,
        });
        const updated = await transaction.repairOrder.updateMany({
          where: {
            id: orderId,
            diagnosisCompletedAt: null,
            status: current.status,
          },
          data: { diagnosisCompletedAt: now, diagnosisFeeRub, visitFeeRub },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        }

        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: current.status,
            to: current.status,
            note:
              diagnosisFeeRub > 0
                ? `Диагностика завершена; начислено ${diagnosisFeeRub} ₽ мастеру`
                : "Диагностика завершена",
          },
        });
        await scheduleTelegramRepairNotification(transaction, {
          orderId,
          userId: current.customerId,
          type: "DIAGNOSIS_COMPLETED",
        });
        await scheduleMaxRepairNotification(transaction, {
          orderId,
          userId: current.customerId,
          type: "DIAGNOSIS_COMPLETED",
        });

        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      response.json({ order });
    },
  );

  router.patch(
    "/orders/:orderId/status",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    validateRequest({
      params: orderIdParams,
      body: statusBody,
    }),
    async (_request, response, next) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const { status, note } = bodyOf<z.infer<typeof statusBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const current = await transaction.repairOrder.findUnique({
          where: { id: orderId },
        });
        if (!current || !canViewRepairOrder(user.role, user.id, current)) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          !canTransitionRepairStatus(
            user.role,
            current.status,
            status,
            current.visitScenarioVersion,
          )
        ) {
          throw new HttpError(
            403,
            "STATUS_TRANSITION_FORBIDDEN",
            "Эта роль не может выполнить такой переход статуса.",
          );
        }
        if (status === "IN_PROGRESS" || status === "READY_FOR_PICKUP") {
          const onsiteVisit = isActiveOnsiteRepairOrder(current);
          if (status === "READY_FOR_PICKUP" && onsiteVisit) {
            throw new HttpError(
              409,
              "ONSITE_REPAIR_MUST_BE_COMPLETED_ONSITE_OR_TRANSFERRED",
              "Выездную заявку завершает мастер на месте либо передаёт технику в сервисный центр.",
            );
          }
          const latestEstimate = await transaction.repairEstimate.findFirst({
            where: { orderId },
            orderBy: { version: "desc" },
            select: { status: true },
          });
          if (
            status === "IN_PROGRESS" &&
            !onsiteVisit &&
            (!latestEstimate || latestEstimate.status !== "APPROVED")
          ) {
            throw new HttpError(
              409,
              "ESTIMATE_APPROVAL_REQUIRED",
              "Нельзя начать ремонт без подтверждённой сметы. Сначала зафиксируйте согласие клиента по телефону.",
            );
          }
          if (
            status === "READY_FOR_PICKUP" &&
            latestEstimate?.status === "PENDING"
          ) {
            throw new HttpError(
              409,
              "ESTIMATE_RESPONSE_PENDING",
              "Сначала зафиксируйте ответ клиента по телефону на дополнительную смету.",
            );
          }
          if (status === "READY_FOR_PICKUP") {
            const diagnosisOnlyReturn =
              current.visitScenarioVersion > 0 &&
              current.diagnosisCompletedAt !== null &&
              latestEstimate?.status === "DECLINED" &&
              (await transaction.repairOrderItem.count({
                where: { orderId },
              })) === 0;
            if (
              current.visitScenarioVersion > 0 &&
              current.repairLocation === "SERVICE_CENTER" &&
              !current.technicianRepairCompletedAt &&
              !diagnosisOnlyReturn
            ) {
              throw new HttpError(
                409,
                "TECHNICIAN_COMPLETION_REQUIRED",
                "Сначала мастер должен отметить ремонт завершённым.",
              );
            }
            const workAct = current.workActRequired
              ? await transaction.repairWorkAct.findUnique({
                  where: { orderId },
                  select: { status: true },
                })
              : null;
            if (!diagnosisOnlyReturn) {
              assertWorkActApproved(current.workActRequired, workAct?.status);
            }
          }
        }
        if (status === "READY_FOR_PICKUP") {
          const intake = await transaction.repairOrderIntake.findUnique({
            where: { orderId },
            select: { conditionSummary: true },
          });
          if (!intake?.conditionSummary.trim()) {
            throw new HttpError(
              409,
              "INTAKE_REQUIRED",
              "Перед выдачей заполните акт приёма и укажите состояние устройства.",
            );
          }
        }
        const changed = await transaction.repairOrder.updateMany({
          where: { id: current.id, status: current.status },
          data: {
            status,
            bonusDiscountRub: current.bonusDiscountRub,
          },
        });
        if (changed.count !== 1)
          throw new HttpError(
            409,
            "ORDER_CHANGED",
            "Заявка уже изменилась. Обновите список и повторите действие.",
          );
        if (status === "CANCELLED") {
          const reservedParts = await transaction.repairOrderItem.findMany({
            where: {
              orderId,
              type: { in: ["SPARE_PART", "PRODUCT"] },
              catalogItemId: { not: null },
            },
            select: { catalogItemId: true, quantity: true },
          });
          for (const part of reservedParts) {
            if (part.catalogItemId) {
              await transaction.repairCatalogItem.updateMany({
                where: { id: part.catalogItemId },
                data: { stockQuantity: { increment: part.quantity } },
              });
            }
          }
        }
        await transaction.repairStatusEvent.create({
          data: {
            orderId,
            actorId: user.id,
            from: current.status,
            to: status,
            note,
          },
        });
        if (status === "READY_FOR_PICKUP") {
          await scheduleTelegramRepairNotification(transaction, {
            orderId,
            userId: current.customerId,
            type: "READY_FOR_PICKUP",
          });
          await scheduleMaxRepairNotification(transaction, {
            orderId,
            userId: current.customerId,
            type: "READY_FOR_PICKUP",
          });
        }
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        status === "READY_FOR_PICKUP"
          ? `Ремонт по заявке ${order.serviceNumber} готов. Технику можно забрать.`
          : "Изменён статус заявки на ремонт.",
        status === "READY_FOR_PICKUP" ? "Ремонт готов к выдаче" : undefined,
      );
      response.json({ order });
    },
  );

  router.post(
    "/orders/:orderId/items",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderIdParams, body: orderItemBody }),
    async (_request, response) => {
      const { orderId } = paramsOf<z.infer<typeof orderIdParams>>(response);
      const input = bodyOf<z.infer<typeof orderItemBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const existing = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            assignedTechnicianId: true,
            status: true,
            deviceType: true,
            workActRequired: true,
          },
        });
        if (!existing || !canAddRepairOrderItem(user.role, user.id, existing))
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        if (
          existing.status === "COMPLETED" ||
          existing.status === "CANCELLED"
        ) {
          throw new HttpError(
            409,
            "ORDER_NOT_EDITABLE",
            "Нельзя добавлять позиции в закрытую заявку.",
          );
        }
        if (existing.workActRequired) {
          throw new HttpError(
            409,
            "WORK_ACT_REQUIRED_FOR_ITEM_CHANGES",
            "Для новой заявки добавляйте фактические работы в акт — без предварительного согласования.",
          );
        }
        if (
          await transaction.repairEstimate.findFirst({ where: { orderId } })
        ) {
          throw new HttpError(
            409,
            "ESTIMATE_REQUIRED_FOR_ITEM_CHANGES",
            "После отправки сметы состав работ можно менять только новой сметой, которую мастер согласует с клиентом.",
          );
        }
        if (existing.status === "IN_PROGRESS" && user.role === "TECHNICIAN") {
          throw new HttpError(
            409,
            "WORK_ACT_REQUIRED_FOR_ITEM_CHANGES",
            "Во время ремонта добавляйте услуги и запчасти в акт. Они попадут в чек и изменят склад после подтверждения клиентом по телефону.",
          );
        }
        const catalogItem = await transaction.repairCatalogItem.findFirst({
          where: { id: input.catalogItemId, active: true },
          select: {
            id: true,
            type: true,
            name: true,
            unitPriceRub: true,
            stockQuantity: true,
            deviceTypes: true,
          },
        });
        if (!catalogItem)
          throw new HttpError(
            404,
            "CATALOG_ITEM_NOT_AVAILABLE",
            "Позиция больше недоступна в каталоге. Обновите список.",
          );
        if (
          catalogItem.type !== "PRODUCT" &&
          !catalogItem.deviceTypes.includes(
            existing.deviceType as (typeof catalogItem.deviceTypes)[number],
          )
        ) {
          throw new HttpError(
            409,
            "CATALOG_ITEM_DEVICE_TYPE_MISMATCH",
            "Эта услуга или запчасть не относится к типу устройства в заявке.",
          );
        }
        if (
          isInventoryCatalogItem(catalogItem.type) &&
          catalogItem.stockQuantity !== null
        ) {
          const stockUpdate = await transaction.repairCatalogItem.updateMany({
            where: {
              id: catalogItem.id,
              stockQuantity: { gte: input.quantity },
            },
            data: { stockQuantity: { decrement: input.quantity } },
          });
          if (stockUpdate.count !== 1) {
            throw new HttpError(
              409,
              catalogItem.type === "PRODUCT"
                ? "INSUFFICIENT_PRODUCT_STOCK"
                : "INSUFFICIENT_SPARE_PART_STOCK",
              `Недостаточно ${catalogItem.type === "PRODUCT" ? "товара" : "запчастей"} на складе.`,
            );
          }
        }
        await transaction.repairOrderItem.create({
          data: {
            orderId,
            catalogItemId: catalogItem.id,
            type: catalogItem.type,
            name: catalogItem.name,
            quantity: input.quantity,
            unitPriceRub: catalogItem.unitPriceRub,
            addedById: user.id,
          },
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Изменён состав услуг, запчастей или товаров по заявке.",
      );
      response.status(201).json({ order });
    },
  );

  router.patch(
    "/orders/:orderId/items/:itemId",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderItemParams, body: orderItemQuantityBody }),
    async (_request, response) => {
      const { orderId, itemId } =
        paramsOf<z.infer<typeof orderItemParams>>(response);
      const { quantity } =
        bodyOf<z.infer<typeof orderItemQuantityBody>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const currentOrder = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            assignedTechnicianId: true,
            status: true,
            workActRequired: true,
            receipt: { select: { paymentStatus: true } },
          },
        });
        if (
          !currentOrder ||
          !canAddRepairOrderItem(user.role, user.id, currentOrder)
        ) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          currentOrder.status === "COMPLETED" ||
          currentOrder.status === "CANCELLED" ||
          currentOrder.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "ORDER_NOT_EDITABLE",
            "Нельзя изменить состав закрытой или оплаченной заявки.",
          );
        }
        if (currentOrder.workActRequired) {
          throw new HttpError(
            409,
            "WORK_ACT_REQUIRED_FOR_ITEM_CHANGES",
            "Состав новой заявки меняйте через акт выполненных работ.",
          );
        }
        if (
          await transaction.repairEstimate.findFirst({ where: { orderId } })
        ) {
          throw new HttpError(
            409,
            "ESTIMATE_REQUIRED_FOR_ITEM_CHANGES",
            "После отправки сметы состав работ можно менять только новой сметой, которую мастер согласует с клиентом.",
          );
        }
        if (
          currentOrder.status === "IN_PROGRESS" &&
          user.role === "TECHNICIAN"
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_REQUIRED_FOR_ITEM_CHANGES",
            "Во время ремонта меняйте услуги и запчасти через акт. Чек и склад обновятся после подтверждения клиентом по телефону.",
          );
        }
        const item = await transaction.repairOrderItem.findFirst({
          where: { id: itemId, orderId },
        });
        if (!item) {
          throw new HttpError(
            404,
            "ORDER_ITEM_NOT_FOUND",
            "Позиция не найдена в этой заявке.",
          );
        }
        const quantityDelta = quantity - item.quantity;
        if (
          quantityDelta !== 0 &&
          isInventoryCatalogItem(item.type) &&
          item.catalogItemId
        ) {
          const catalogItem = await transaction.repairCatalogItem.findUnique({
            where: { id: item.catalogItemId },
            select: { stockQuantity: true },
          });
          if (catalogItem && catalogItem.stockQuantity !== null) {
            if (quantityDelta > 0) {
              const stockUpdate =
                await transaction.repairCatalogItem.updateMany({
                  where: {
                    id: item.catalogItemId,
                    stockQuantity: { gte: quantityDelta },
                  },
                  data: { stockQuantity: { decrement: quantityDelta } },
                });
              if (stockUpdate.count !== 1) {
                throw new HttpError(
                  409,
                  item.type === "PRODUCT"
                    ? "INSUFFICIENT_PRODUCT_STOCK"
                    : "INSUFFICIENT_SPARE_PART_STOCK",
                  `Недостаточно ${item.type === "PRODUCT" ? "товара" : "запчастей"} на складе для изменения количества.`,
                );
              }
            } else {
              await transaction.repairCatalogItem.updateMany({
                where: { id: item.catalogItemId },
                data: { stockQuantity: { increment: -quantityDelta } },
              });
            }
          }
        }
        await transaction.repairOrderItem.update({
          where: { id: item.id },
          data: { quantity },
        });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Изменено количество позиции в составе заявки.",
      );
      response.json({ order });
    },
  );

  router.delete(
    "/orders/:orderId/items/:itemId",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: orderItemParams }),
    async (_request, response) => {
      const { orderId, itemId } =
        paramsOf<z.infer<typeof orderItemParams>>(response);
      const user = getAuthenticatedUser(response);
      const order = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "repair_orders" WHERE "id" = ${orderId}::uuid FOR UPDATE
        `;
        const currentOrder = await transaction.repairOrder.findUnique({
          where: { id: orderId },
          select: {
            id: true,
            assignedTechnicianId: true,
            status: true,
            workActRequired: true,
            receipt: { select: { paymentStatus: true } },
          },
        });
        if (
          !currentOrder ||
          !canAddRepairOrderItem(user.role, user.id, currentOrder)
        ) {
          throw new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена.");
        }
        if (
          currentOrder.status === "COMPLETED" ||
          currentOrder.status === "CANCELLED" ||
          currentOrder.receipt?.paymentStatus === "PAID"
        ) {
          throw new HttpError(
            409,
            "ORDER_NOT_EDITABLE",
            "Нельзя удалить позицию из закрытой или оплаченной заявки.",
          );
        }
        if (currentOrder.workActRequired) {
          throw new HttpError(
            409,
            "WORK_ACT_REQUIRED_FOR_ITEM_CHANGES",
            "Состав новой заявки меняйте через акт выполненных работ.",
          );
        }
        if (
          await transaction.repairEstimate.findFirst({ where: { orderId } })
        ) {
          throw new HttpError(
            409,
            "ESTIMATE_REQUIRED_FOR_ITEM_CHANGES",
            "После отправки сметы состав работ можно менять только через новую смету для согласования с клиентом по телефону.",
          );
        }
        if (
          currentOrder.status === "IN_PROGRESS" &&
          user.role === "TECHNICIAN"
        ) {
          throw new HttpError(
            409,
            "WORK_ACT_REQUIRED_FOR_ITEM_CHANGES",
            "Во время ремонта меняйте услуги и запчасти через акт. Чек и склад обновятся после того, как назначенный мастер зафиксирует ответ клиента по телефону.",
          );
        }
        const item = await transaction.repairOrderItem.findFirst({
          where: { id: itemId, orderId },
        });
        if (!item) {
          throw new HttpError(
            404,
            "ORDER_ITEM_NOT_FOUND",
            "Позиция не найдена в этой заявке.",
          );
        }
        if (isInventoryCatalogItem(item.type) && item.catalogItemId) {
          await transaction.repairCatalogItem.updateMany({
            where: { id: item.catalogItemId },
            data: { stockQuantity: { increment: item.quantity } },
          });
        }
        await transaction.repairOrderItem.delete({ where: { id: item.id } });
        return transaction.repairOrder.findUniqueOrThrow({
          where: { id: orderId },
          include: orderDetails(user.role),
        });
      });
      await sendRepairOrderNotification(
        database,
        order,
        user.id,
        "Изменён состав услуг, запчастей или товаров по заявке.",
      );
      response.json({ order });
    },
  );

  router.get(
    "/reviews",
    requireAuth,
    requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const where =
        user.role === "CUSTOMER"
          ? { OR: [{ customerId: user.id }, { isPublished: true }] }
          : user.role === "TECHNICIAN"
            ? { isPublished: true, order: { assignedTechnicianId: user.id } }
            : {};
      const reviews = await database.review.findMany({
        where,
        include: {
          customer: { select: { id: true, displayName: true } },
          order: {
            select: {
              id: true,
              deviceType: true,
              problem: true,
              assignedTechnician: { select: { id: true, displayName: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });
      response.json({ reviews });
    },
  );

  router.patch(
    "/reviews/:reviewId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: reviewIdParams, body: moderateReviewBody }),
    async (_request, response) => {
      const { reviewId } = paramsOf<z.infer<typeof reviewIdParams>>(response);
      const { isPublished } =
        bodyOf<z.infer<typeof moderateReviewBody>>(response);
      const current = await database.review.findUnique({
        where: { id: reviewId },
        select: { orderId: true },
      });
      const user = getAuthenticatedUser(response);
      const review = await database.review.update({
        where: { id: reviewId },
        data: { isPublished },
      });
      if (current) {
        await sendRepairOrderNotificationForId(
          database,
          current.orderId,
          user.id,
          "Изменён статус отзыва по заявке.",
        );
      }
      response.json({ review });
    },
  );

  router.post(
    "/reviews",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: reviewBody }),
    async (_request, response, next) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof reviewBody>>(response);
      const order = await database.repairOrder.findUnique({
        where: { id: input.orderId },
      });
      if (!order || order.customerId !== user.id) {
        next(new HttpError(404, "ORDER_NOT_FOUND", "Заявка не найдена."));
        return;
      }
      if (order.status !== "COMPLETED") {
        next(
          new HttpError(
            409,
            "ORDER_NOT_COMPLETED",
            "Отзыв можно оставить после завершения ремонта.",
          ),
        );
        return;
      }
      try {
        const review = await database.review.create({
          data: {
            orderId: order.id,
            customerId: user.id,
            rating: input.rating,
            comment: input.comment,
            isPublished: false,
          },
        });
        await sendRepairOrderNotification(
          database,
          order,
          user.id,
          "К завершённой заявке добавлен отзыв.",
        );
        response.status(201).json({ review });
      } catch (error) {
        if (isUniqueViolation(error))
          next(
            new HttpError(
              409,
              "REVIEW_ALREADY_EXISTS",
              "Для этой заявки отзыв уже оставлен.",
            ),
          );
        else next(error);
      }
    },
  );

  router.use(createRepairOrderReleaseRouter(database));
  router.use(createRepairVisitRouter(database));
  router.use(createRepairTechnicianCompletionRouter(database));
  router.use(createRepairReviewRequestRouter(database));
  return router;
};
