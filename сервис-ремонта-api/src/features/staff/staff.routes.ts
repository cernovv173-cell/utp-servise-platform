import { type RequestHandler, Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  publicUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import {
  generateAccountLogin,
  generateTemporaryPassword,
  hashPassword,
} from "../auth/passwords.js";

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const phoneNumberSchema = z
  .string()
  .trim()
  .max(32)
  .refine(
    (value) =>
      /^[+0-9().\-\s]+$/.test(value) &&
      value.replace(/\D/g, "").length >= 7 &&
      value.replace(/\D/g, "").length <= 15,
  )
  .nullable()
  .optional();
const staffSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(2).max(120),
    phoneNumber: phoneNumberSchema,
    role: z.enum(["TECHNICIAN", "ADMIN", "PROCUREMENT"]).default("TECHNICIAN"),
  })
  .strict();
const updateTechnicianSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    phoneNumber: phoneNumberSchema,
    salaryRatePercent: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);
const userIdParams = z.object({ userId: z.string().uuid() });
const technicianProfileBody = z
  .object({
    displayName: z.string().trim().min(2).max(120),
    phoneNumber: phoneNumberSchema,
    experienceYears: z.number().int().min(0).max(70).nullable().optional(),
    homeAddress: z.string().trim().max(500),
    bio: z.string().trim().max(2000).optional().default(""),
    certificates: z
      .array(z.string().trim().min(1).max(200))
      .max(20)
      .optional()
      .default([]),
  })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const userIdOf = (response: { locals: { input?: unknown } }): string =>
  (response.locals.input as { readonly params: z.infer<typeof userIdParams> })
    .params.userId;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createStaffRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/staff/:userId/profile",
    requireAuth,
    validateRequest({ params: userIdParams }),
    async (_request, response) => {
      const userId = userIdOf(response);
      const actor = getAuthenticatedUser(response);
      const isSelf = actor.id === userId && actor.role === "TECHNICIAN";
      const isAdmin = actor.role === "ADMIN";
      let profile = await database.technicianProfile.findUnique({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              displayName: true,
              avatarObjectId: true,
              phoneNumber: true,
              role: true,
            },
          },
        },
      });
      if (!profile && isSelf) {
        await database.technicianProfile.upsert({
          where: { userId },
          create: { userId },
          update: {},
        });
        profile = await database.technicianProfile.findUnique({
          where: { userId },
          include: {
            user: {
              select: {
                id: true,
                displayName: true,
                avatarObjectId: true,
                phoneNumber: true,
                role: true,
              },
            },
          },
        });
      }
      if (!profile || profile.user.role !== "TECHNICIAN")
        throw new HttpError(
          404,
          "TECHNICIAN_PROFILE_NOT_FOUND",
          "Профиль мастера не найден.",
        );
      const { homeAddress, isVerified, verifiedAt, ...publicProfile } = profile;
      const [completedOrders, reviews, works] = await Promise.all([
        database.repairOrder.count({
          where: { assignedTechnicianId: userId, status: "COMPLETED" },
        }),
        database.review.findMany({
          where: {
            isPublished: true,
            order: { assignedTechnicianId: userId, status: "COMPLETED" },
          },
          select: {
            id: true,
            rating: true,
            comment: true,
            createdAt: true,
            customer: { select: { displayName: true } },
            order: { select: { deviceType: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 100,
        }),
        database.repairOrderPhoto.findMany({
          where: {
            portfolioConsentAt: { not: null },
            order: { assignedTechnicianId: userId, status: "COMPLETED" },
          },
          select: {
            id: true,
            objectId: true,
            order: { select: { deviceType: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        }),
      ]);
      response.json({
        profile: {
          ...publicProfile,
          ...(isSelf || isAdmin ? { homeAddress } : {}),
          completedOrders,
          rating: reviews.length
            ? reviews.reduce((sum, review) => sum + review.rating, 0) /
              reviews.length
            : null,
          reviews,
          works: works.map(({ order, ...photo }) => ({
            ...photo,
            deviceType: order.deviceType,
          })),
        },
      });
    },
  );

  router.put(
    "/staff/:userId/profile",
    requireAuth,
    requireRoles("TECHNICIAN"),
    validateRequest({ params: userIdParams, body: technicianProfileBody }),
    async (_request, response) => {
      const userId = userIdOf(response);
      if (getAuthenticatedUser(response).id !== userId)
        throw new HttpError(
          403,
          "PROFILE_OWNER_REQUIRED",
          "Можно менять только собственный профиль.",
        );
      const input = bodyOf<z.infer<typeof technicianProfileBody>>(response);
      const technician = await database.user.findFirst({
        where: { id: userId, role: "TECHNICIAN" },
        select: { id: true },
      });
      if (!technician)
        throw new HttpError(404, "STAFF_NOT_FOUND", "Мастер не найден.");
      const [updatedUser, profile] = await Promise.all([
        database.user.update({
          where: { id: userId },
          data: {
            displayName: input.displayName,
            phoneNumber: input.phoneNumber || null,
          },
        }),
        database.technicianProfile.upsert({
          where: { userId },
          create: {
            userId,
            experienceYears: input.experienceYears ?? null,
            homeAddress: input.homeAddress,
          },
          update: {
            ...(input.experienceYears !== undefined
              ? { experienceYears: input.experienceYears }
              : {}),
            homeAddress: input.homeAddress,
          },
        }),
      ]);
      const { isVerified, verifiedAt, ...savedProfile } = profile;
      response.json({
        profile: {
          ...savedProfile,
          user: {
            id: updatedUser.id,
            displayName: updatedUser.displayName,
            avatarObjectId: updatedUser.avatarObjectId,
            phoneNumber: updatedUser.phoneNumber,
          },
        },
      });
    },
  );

  router.get(
    "/staff",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const staff = await database.user.findMany({
        where: { role: { in: ["TECHNICIAN", "ADMIN", "PROCUREMENT"] } },
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          login: true,
          avatarObjectId: true,
          role: true,
          salaryRatePercent: true,
          active: true,
          terminatedAt: true,
          createdAt: true,
        },
        orderBy: [{ active: "desc" }, { displayName: "asc" }],
      });
      response.json({ staff });
    },
  );

  router.post(
    "/staff",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: staffSchema }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof staffSchema>>(response);
      const temporaryPassword = generateTemporaryPassword();
      try {
        const staff = await database.user.create({
          data: {
            email: input.email,
            login: generateAccountLogin(),
            displayName: input.displayName,
            phoneNumber: input.phoneNumber?.trim() || null,
            role: input.role,
            passwordHash: await hashPassword(temporaryPassword),
            mustChangePassword: true,
          },
        });
        response
          .status(201)
          .json({ staff: publicUser(staff), temporaryPassword });
      } catch (error) {
        if (isUniqueViolation(error))
          next(
            new HttpError(
              409,
              "EMAIL_IN_USE",
              "Этот адрес электронной почты уже зарегистрирован.",
            ),
          );
        else next(error);
      }
    },
  );

  router.patch(
    "/staff/:userId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: userIdParams, body: updateTechnicianSchema }),
    async (_request, response) => {
      const userId = userIdOf(response);
      const input = bodyOf<z.infer<typeof updateTechnicianSchema>>(response);
      const target = await database.user.findFirst({
        where: { id: userId, role: "TECHNICIAN" },
        select: { id: true },
      });
      if (!target)
        throw new HttpError(404, "STAFF_NOT_FOUND", "Мастер не найден.");

      const staff = await database.user.update({
        where: { id: target.id },
        data: {
          displayName: input.displayName,
          phoneNumber:
            input.phoneNumber === undefined
              ? undefined
              : input.phoneNumber?.trim() || null,
          salaryRatePercent: input.salaryRatePercent,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          avatarObjectId: true,
          role: true,
          salaryRatePercent: true,
          active: true,
          createdAt: true,
        },
      });
      response.json({ staff });
    },
  );

  router.patch(
    "/staff/:userId/active",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({
      params: userIdParams,
      body: z.object({ active: z.boolean() }).strict(),
    }),
    async (_request, response, next) => {
      const userId = userIdOf(response);
      const { active } = bodyOf<{ readonly active: boolean }>(response);
      const actor = getAuthenticatedUser(response);
      if (actor.id === userId && !active) {
        next(
          new HttpError(
            409,
            "CANNOT_DEACTIVATE_SELF",
            "Нельзя отключить собственную учётную запись.",
          ),
        );
        return;
      }
      const target = await database.user.findUnique({ where: { id: userId } });
      if (
        !target ||
        !["TECHNICIAN", "ADMIN", "PROCUREMENT"].includes(target.role)
      ) {
        next(new HttpError(404, "STAFF_NOT_FOUND", "Сотрудник не найден."));
        return;
      }
      if (target.terminatedAt && active) {
        next(
          new HttpError(
            409,
            "STAFF_PERMANENTLY_TERMINATED",
            "Уволенную учётную запись нельзя восстановить. Создайте новую запись сотрудника.",
          ),
        );
        return;
      }
      if (target.role === "ADMIN" && target.active && !active) {
        const activeAdmins = await database.user.count({
          where: { role: "ADMIN", active: true },
        });
        if (activeAdmins <= 1) {
          next(
            new HttpError(
              409,
              "LAST_ADMIN_REQUIRED",
              "В системе должен оставаться хотя бы один активный администратор.",
            ),
          );
          return;
        }
      }
      const staff = await database.user.update({
        where: { id: userId },
        data: { active },
        select: {
          id: true,
          email: true,
          login: true,
          displayName: true,
          phoneNumber: true,
          avatarObjectId: true,
          role: true,
          active: true,
          terminatedAt: true,
          createdAt: true,
        },
      });
      if (!active) await database.session.deleteMany({ where: { userId } });
      response.json({ staff });
    },
  );

  const terminateStaff: RequestHandler = async (_request, response, next) => {
    const userId = userIdOf(response);
    const actor = getAuthenticatedUser(response);
    if (actor.id === userId) {
      next(
        new HttpError(
          409,
          "CANNOT_TERMINATE_SELF",
          "Нельзя навсегда уволить собственную учётную запись.",
        ),
      );
      return;
    }

    try {
      const staff = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "users"
          WHERE "id" = ${userId}::uuid OR "id" = ${actor.id}::uuid
          ORDER BY "id"
          FOR UPDATE
        `;
        const [currentActor, target] = await Promise.all([
          transaction.user.findUnique({
            where: { id: actor.id },
            select: { id: true, role: true, active: true, terminatedAt: true },
          }),
          transaction.user.findUnique({ where: { id: userId } }),
        ]);
        if (
          !currentActor ||
          currentActor.role !== "ADMIN" ||
          !currentActor.active ||
          currentActor.terminatedAt
        ) {
          throw new HttpError(
            403,
            "FORBIDDEN",
            "Недостаточно прав для этого действия.",
          );
        }
        if (
          !target ||
          !["TECHNICIAN", "ADMIN", "PROCUREMENT"].includes(target.role)
        ) {
          throw new HttpError(404, "STAFF_NOT_FOUND", "Сотрудник не найден.");
        }
        if (target.terminatedAt) return target;
        if (target.role === "ADMIN" && target.active) {
          const activeAdmins = await transaction.user.count({
            where: { role: "ADMIN", active: true, terminatedAt: null },
          });
          if (activeAdmins <= 1) {
            throw new HttpError(
              409,
              "LAST_ADMIN_REQUIRED",
              "В системе должен оставаться хотя бы один активный администратор.",
            );
          }
        }

        const now = new Date();
        const activeOrders = await transaction.repairOrder.findMany({
          where: {
            assignedTechnicianId: userId,
            status: { notIn: ["COMPLETED", "CANCELLED"] },
          },
          select: { id: true, status: true },
        });
        if (activeOrders.length > 0) {
          await transaction.repairOrder.updateMany({
            where: {
              assignedTechnicianId: userId,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
            data: { assignedTechnicianId: null },
          });
          await transaction.repairStatusEvent.createMany({
            data: activeOrders.map((order) => ({
              orderId: order.id,
              actorId: actor.id,
              from: order.status,
              to: order.status,
              note: "Сотрудник уволен. Заявка возвращена администраторам для переназначения.",
            })),
          });
        }

        await Promise.all([
          transaction.session.deleteMany({ where: { userId } }),
          transaction.passwordResetToken.deleteMany({ where: { userId } }),
          transaction.pushDeviceToken.deleteMany({ where: { userId } }),
          transaction.maxLinkToken.updateMany({
            where: { userId, usedAt: null },
            data: { usedAt: now },
          }),
          transaction.maxLoginRequest.updateMany({
            where: {
              userId,
              status: { in: ["PENDING", "AWAITING_CONTACT", "CONFIRMED"] },
            },
            data: {
              status: "FAILED",
              failureCode: "STAFF_TERMINATED",
              failureMessage: "Учётная запись сотрудника отключена.",
            },
          }),
        ]);

        return transaction.user.update({
          where: { id: userId },
          data: {
            active: false,
            terminatedAt: now,
            terminatedById: actor.id,
            maxUserId: null,
            telegramChatId: null,
          },
        });
      });
      response.json({ staff: publicUser(staff) });
    } catch (error) {
      next(error);
    }
  };

  router.post(
    "/staff/:userId/terminate",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: userIdParams }),
    terminateStaff,
  );

  // Preserve the old client route, but make it a safe permanent offboarding action.
  router.delete(
    "/staff/:userId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: userIdParams }),
    terminateStaff,
  );

  return router;
};
