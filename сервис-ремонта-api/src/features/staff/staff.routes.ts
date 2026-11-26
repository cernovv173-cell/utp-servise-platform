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
import { requireStaffPermission } from "../auth/auth.middleware.js";
import {
  generateAccountLogin,
  generateTemporaryPassword,
  hashPassword,
} from "../auth/passwords.js";
import {
  STAFF_PERMISSION_KEYS,
  STAFF_PERMISSION_OPTIONS,
  type StaffPermission,
  assertCanAssignPermissions,
  hasStaffPermission,
  isFullAdmin,
  permissionsForUser,
  publicRoleForUser,
} from "../auth/staff-permissions.js";

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
    permissions: z
      .array(z.enum(STAFF_PERMISSION_KEYS))
      .max(STAFF_PERMISSION_KEYS.length)
      .optional(),
    fullAdministrator: z.boolean().default(false),
    // Older app releases still send a role. Convert it to permissions; never persist PROCUREMENT.
    role: z
      .enum(["TECHNICIAN", "ADMIN", "ADMIN_ASSISTANT", "PROCUREMENT"])
      .optional(),
  })
  .strict();
const updateTechnicianSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    phoneNumber: phoneNumberSchema,
    salaryRatePercent: z.number().int().min(0).max(100).optional(),
    permissions: z
      .array(z.enum(STAFF_PERMISSION_KEYS))
      .max(STAFF_PERMISSION_KEYS.length)
      .optional(),
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

const legacyRolePermissions = (
  role: z.infer<typeof staffSchema>["role"],
): StaffPermission[] => {
  if (role === "TECHNICIAN") return ["repairs"];
  if (role === "PROCUREMENT") return ["inventory"];
  if (role === "ADMIN_ASSISTANT") return [...STAFF_PERMISSION_KEYS];
  return [];
};

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
      const isSelf =
        actor.id === userId && hasStaffPermission(actor, "repairs");
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
              isAdminAssistant: true,
              staffPermissions: true,
              staffPermissionsConfigured: true,
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
                isAdminAssistant: true,
                staffPermissions: true,
                staffPermissionsConfigured: true,
              },
            },
          },
        });
      }
      if (!profile || !hasStaffPermission(profile.user, "repairs"))
        throw new HttpError(
          404,
          "TECHNICIAN_PROFILE_NOT_FOUND",
          "Профиль мастера не найден.",
        );
      const {
        homeAddress,
        isVerified,
        verifiedAt,
        user: profileUser,
        ...publicProfile
      } = profile;
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
          user: {
            id: profileUser.id,
            displayName: profileUser.displayName,
            avatarObjectId: profileUser.avatarObjectId,
            phoneNumber: profileUser.phoneNumber,
            role: publicRoleForUser(profileUser),
            permissions: permissionsForUser(profileUser),
          },
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
    requireStaffPermission("repairs"),
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
      const technician = await database.user.findUnique({
        where: { id: userId },
      });
      if (!technician || !hasStaffPermission(technician, "repairs"))
        throw new HttpError(404, "STAFF_NOT_FOUND", "Сотрудник не найден.");
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
    requireStaffPermission("staff_management"),
    async (_request, response) => {
      const actor = getAuthenticatedUser(response);
      const staff = await database.user.findMany({
        where: {
          role: { in: ["TECHNICIAN", "ADMIN", "PROCUREMENT"] },
          terminatedAt: null,
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          login: true,
          avatarObjectId: true,
          role: true,
          isAdminAssistant: true,
          staffPermissions: true,
          staffPermissionsConfigured: true,
          salaryRatePercent: true,
          active: true,
          terminatedAt: true,
          createdAt: true,
        },
        orderBy: [{ active: "desc" }, { displayName: "asc" }],
      });
      response.json({
        permissionOptions: STAFF_PERMISSION_OPTIONS.filter(
          ({ key }) => isFullAdmin(actor) || hasStaffPermission(actor, key),
        ),
        staff: staff.map((member) => ({
          ...member,
          role: publicRoleForUser(member),
          permissions: permissionsForUser(member),
        })),
      });
    },
  );

  router.post(
    "/staff",
    requireAuth,
    requireStaffPermission("staff_management"),
    validateRequest({ body: staffSchema }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof staffSchema>>(response);
      const actor = getAuthenticatedUser(response);
      const fullAdministrator =
        input.fullAdministrator || input.role === "ADMIN";
      if (fullAdministrator && !isFullAdmin(actor)) {
        next(
          new HttpError(
            403,
            "ADMIN_CREATION_FORBIDDEN",
            "Создавать учётные записи с полным доступом может только администратор.",
          ),
        );
        return;
      }
      const permissions = fullAdministrator
        ? []
        : (input.permissions ?? legacyRolePermissions(input.role));
      assertCanAssignPermissions(actor, permissions);
      const temporaryPassword = generateTemporaryPassword();
      try {
        const staff = await database.user.create({
          data: {
            email: input.email,
            login: generateAccountLogin(),
            displayName: input.displayName,
            phoneNumber: input.phoneNumber?.trim() || null,
            role: fullAdministrator ? "ADMIN" : "TECHNICIAN",
            isAdminAssistant: false,
            staffPermissions: permissions,
            staffPermissionsConfigured: !fullAdministrator,
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
    requireStaffPermission("staff_management"),
    validateRequest({ params: userIdParams, body: updateTechnicianSchema }),
    async (_request, response) => {
      const userId = userIdOf(response);
      const input = bodyOf<z.infer<typeof updateTechnicianSchema>>(response);
      const actor = getAuthenticatedUser(response);
      const target = await database.user.findUnique({ where: { id: userId } });
      if (!target || target.role === "CUSTOMER" || isFullAdmin(target)) {
        throw new HttpError(404, "STAFF_NOT_FOUND", "Сотрудник не найден.");
      }
      const updatedPermissions =
        input.permissions === undefined
          ? undefined
          : (() => {
              const actorPermissions = new Set(permissionsForUser(actor));
              const requested = new Set(input.permissions);
              if (!isFullAdmin(actor)) {
                for (const permission of permissionsForUser(target)) {
                  if (!actorPermissions.has(permission))
                    requested.add(permission);
                }
              }
              return [...requested];
            })();
      if (input.permissions !== undefined) {
        if (actor.id === target.id) {
          throw new HttpError(
            409,
            "CANNOT_EDIT_SELF_PERMISSIONS",
            "Изменять собственные права доступа нельзя.",
          );
        }
        assertCanAssignPermissions(actor, updatedPermissions ?? []);
        if (
          hasStaffPermission(target, "repairs") &&
          !updatedPermissions?.includes("repairs")
        ) {
          const activeAssignments = await database.repairOrder.count({
            where: {
              assignedTechnicianId: target.id,
              status: { notIn: ["COMPLETED", "CANCELLED"] },
            },
          });
          if (activeAssignments > 0) {
            throw new HttpError(
              409,
              "ACTIVE_REPAIRS_REQUIRE_REASSIGNMENT",
              "Сначала переназначьте незавершённые заявки сотрудника.",
            );
          }
        }
      }
      const resultingPermissions =
        updatedPermissions ?? permissionsForUser(target);
      if (
        input.salaryRatePercent !== undefined &&
        !resultingPermissions.includes("repairs")
      ) {
        throw new HttpError(
          400,
          "SALARY_RATE_REQUIRES_REPAIR_ACCESS",
          "Процент начислений можно настроить сотруднику с доступом к ремонту.",
        );
      }

      const staff = await database.user.update({
        where: { id: target.id },
        data: {
          ...(input.permissions !== undefined
            ? { role: "TECHNICIAN", isAdminAssistant: false }
            : {}),
          ...(input.displayName !== undefined
            ? { displayName: input.displayName }
            : {}),
          ...(input.phoneNumber !== undefined
            ? { phoneNumber: input.phoneNumber?.trim() || null }
            : {}),
          ...(input.salaryRatePercent !== undefined
            ? { salaryRatePercent: input.salaryRatePercent }
            : {}),
          ...(input.permissions !== undefined
            ? {
                staffPermissions: updatedPermissions ?? [],
                staffPermissionsConfigured: true,
              }
            : {}),
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          avatarObjectId: true,
          role: true,
          isAdminAssistant: true,
          staffPermissions: true,
          staffPermissionsConfigured: true,
          salaryRatePercent: true,
          active: true,
          createdAt: true,
        },
      });
      response.json({
        staff: {
          ...staff,
          role: publicRoleForUser(staff),
          permissions: permissionsForUser(staff),
        },
      });
    },
  );

  router.patch(
    "/staff/:userId/active",
    requireAuth,
    requireStaffPermission("staff_management"),
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
      if (!target || target.role === "CUSTOMER") {
        next(new HttpError(404, "STAFF_NOT_FOUND", "Сотрудник не найден."));
        return;
      }
      if (isFullAdmin(target) && !isFullAdmin(actor)) {
        next(
          new HttpError(
            403,
            "FULL_ADMIN_PROTECTED",
            "Отключить администратора с полным доступом может только он сам или другой полный администратор.",
          ),
        );
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
      if (
        target.role === "ADMIN" &&
        !target.isAdminAssistant &&
        target.active &&
        !active
      ) {
        const activeAdmins = await database.user.count({
          where: { role: "ADMIN", isAdminAssistant: false, active: true },
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
          isAdminAssistant: true,
          staffPermissions: true,
          staffPermissionsConfigured: true,
          active: true,
          terminatedAt: true,
          createdAt: true,
        },
      });
      if (!active) await database.session.deleteMany({ where: { userId } });
      response.json({
        staff: {
          ...staff,
          role: publicRoleForUser(staff),
          permissions: permissionsForUser(staff),
        },
      });
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
            select: {
              id: true,
              role: true,
              isAdminAssistant: true,
              staffPermissions: true,
              staffPermissionsConfigured: true,
              active: true,
              terminatedAt: true,
            },
          }),
          transaction.user.findUnique({ where: { id: userId } }),
        ]);
        if (
          !currentActor ||
          !hasStaffPermission(currentActor, "staff_management") ||
          !currentActor.active ||
          currentActor.terminatedAt
        ) {
          throw new HttpError(
            403,
            "FORBIDDEN",
            "Недостаточно прав для этого действия.",
          );
        }
        if (!target || target.role === "CUSTOMER") {
          throw new HttpError(404, "STAFF_NOT_FOUND", "Сотрудник не найден.");
        }
        if (isFullAdmin(target) && !isFullAdmin(currentActor)) {
          throw new HttpError(
            403,
            "FULL_ADMIN_PROTECTED",
            "Уволить администратора с полным доступом может только другой полный администратор.",
          );
        }
        if (target.terminatedAt) return target;
        if (
          target.role === "ADMIN" &&
          !target.isAdminAssistant &&
          target.active
        ) {
          const activeAdmins = await transaction.user.count({
            where: {
              role: "ADMIN",
              isAdminAssistant: false,
              active: true,
              terminatedAt: null,
            },
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
    requireStaffPermission("staff_management"),
    validateRequest({ params: userIdParams }),
    terminateStaff,
  );

  // Preserve the old client route, but make it a safe permanent offboarding action.
  router.delete(
    "/staff/:userId",
    requireAuth,
    requireStaffPermission("staff_management"),
    validateRequest({ params: userIdParams }),
    terminateStaff,
  );

  return router;
};
