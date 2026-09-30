import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  hashSessionToken,
  publicUser,
  requireRoles,
} from "./auth.middleware.js";
import {
  generateTemporaryPassword,
  hashPassword,
  performDummyPasswordCheck,
  verifyPassword,
} from "./passwords.js";

const SESSION_LIFETIME_MS = 14 * 24 * 60 * 60 * 1_000;
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const passwordSchema = z.string().min(12).max(128);
const registerSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(2).max(120),
    password: passwordSchema,
  })
  .strict();
const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    portal: z.enum(["CUSTOMER", "TECHNICIAN", "ADMIN"]),
  })
  .strict();
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict();
const staffSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(2).max(120),
    role: z.enum(["TECHNICIAN", "ADMIN"]).default("TECHNICIAN"),
  })
  .strict();

type Body<T> = { readonly body: T };

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as Body<T>).body;

const createSession = async (database: DatabaseClient, userId: string) => {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await database.session.create({
    data: { tokenHash: hashSessionToken(token), userId, expiresAt },
  });
  return { accessToken: token, expiresAt };
};

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createAuthRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.post(
    "/auth/register",
    validateRequest({ body: registerSchema }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof registerSchema>>(response);
      try {
        const user = await database.user.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            passwordHash: await hashPassword(input.password),
            role: "CUSTOMER",
          },
        });
        const session = await createSession(database, user.id);
        response.status(201).json({
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
          user: publicUser(user),
        });
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

  router.post(
    "/auth/login",
    validateRequest({ body: loginSchema }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof loginSchema>>(response);
      const user = await database.user.findUnique({
        where: { email: input.email },
      });
      const valid = user
        ? await verifyPassword(input.password, user.passwordHash)
        : (await performDummyPasswordCheck(input.password), false);
      if (!user || !valid || !user.active || user.role !== input.portal) {
        next(
          new HttpError(
            401,
            "INVALID_CREDENTIALS",
            "Неверный адрес или пароль.",
          ),
        );
        return;
      }
      const session = await createSession(database, user.id);
      response.json({
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user: publicUser(user),
      });
    },
  );

  router.get("/auth/me", requireAuth, (_request, response) => {
    response.json({ user: publicUser(getAuthenticatedUser(response)) });
  });

  router.post("/auth/logout", requireAuth, async (request, response) => {
    const token = request.header("authorization")!.slice("Bearer ".length);
    await database.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
    response.status(204).end();
  });

  router.post(
    "/auth/change-password",
    requireAuth,
    validateRequest({ body: changePasswordSchema }),
    async (_request, response, next) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof changePasswordSchema>>(response);
      const current = await database.user.findUnique({
        where: { id: user.id },
      });
      if (
        !current ||
        !(await verifyPassword(input.currentPassword, current.passwordHash))
      ) {
        next(
          new HttpError(
            401,
            "INVALID_CREDENTIALS",
            "Текущий пароль указан неверно.",
          ),
        );
        return;
      }
      const passwordHash = await hashPassword(input.newPassword);
      await database.user.update({
        where: { id: user.id },
        data: { passwordHash, mustChangePassword: false },
      });
      await database.session.deleteMany({ where: { userId: user.id } });
      const session = await createSession(database, user.id);
      response.json({
        accessToken: session.accessToken,
        expiresAt: session.expiresAt,
        user: { ...publicUser(user), mustChangePassword: false },
      });
    },
  );

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
    "/staff/:userId/active",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({
      params: z.object({ userId: z.string().uuid() }),
      body: z.object({ active: z.boolean() }).strict(),
    }),
    async (_request, response, next) => {
      const userId = (response.locals.input as { params: { userId: string } })
        .params.userId;
      const { active } = (
        response.locals.input as { body: { active: boolean } }
      ).body;
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

export const ensureInitialAdmin = async (
  database: DatabaseClient,
  emailInput: string | undefined,
  password: string | undefined,
): Promise<void> => {
  if (!emailInput || !password) return;
  const email = emailSchema.parse(emailInput);
  passwordSchema.parse(password);
  await database.$transaction(async (transaction) => {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('utp-servise-initial-admin'))`;
    const existingAdmin = await transaction.user.findFirst({
      where: { role: "ADMIN" },
    });
    if (existingAdmin) return;
    const existingUser = await transaction.user.findUnique({
      where: { email },
    });
    if (existingUser)
      throw new Error(
        "Initial administrator address is already used by a non-admin account.",
      );
    await transaction.user.create({
      data: {
        email,
        displayName: "Администратор UTP Servise",
        passwordHash: await hashPassword(password),
        role: "ADMIN",
        mustChangePassword: true,
      },
    });
  });
};
