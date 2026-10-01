import { Router } from "express";
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
import { generateTemporaryPassword, hashPassword } from "../auth/passwords.js";

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
    role: z.enum(["TECHNICIAN", "ADMIN"]).default("TECHNICIAN"),
  })
  .strict();
const updateTechnicianSchema = z
  .object({
    displayName: z.string().trim().min(2).max(120).optional(),
    phoneNumber: phoneNumberSchema,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);
const userIdParams = z.object({ userId: z.string().uuid() });

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
    "/staff",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const staff = await database.user.findMany({
        where: { role: { in: ["TECHNICIAN", "ADMIN"] } },
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          avatarObjectId: true,
          role: true,
          active: true,
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
        },
        select: {
          id: true,
          email: true,
          displayName: true,
          phoneNumber: true,
          avatarObjectId: true,
          role: true,
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
        (target.role !== "TECHNICIAN" && target.role !== "ADMIN")
      ) {
        next(new HttpError(404, "STAFF_NOT_FOUND", "Сотрудник не найден."));
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
          displayName: true,
          phoneNumber: true,
          avatarObjectId: true,
          role: true,
          active: true,
          createdAt: true,
        },
      });
      if (!active) await database.session.deleteMany({ where: { userId } });
      response.json({ staff });
    },
  );

  return router;
};
