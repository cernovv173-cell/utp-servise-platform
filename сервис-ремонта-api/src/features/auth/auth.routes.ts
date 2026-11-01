import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createCustomerWithReferral } from "../referrals/customer-registration.js";
import { referralCodeSchema } from "../referrals/referral-code.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  hashSessionToken,
  publicUser,
} from "./auth.middleware.js";
import {
  hashPassword,
  performDummyPasswordCheck,
  verifyPassword,
} from "./passwords.js";
import { createSession, isUniqueViolation } from "./session.js";
import {
  type VkAuthRouterOptions,
  createVkAuthRouter,
} from "./vk-auth.routes.js";
import { type YandexIdentity, getYandexIdentity } from "./yandex-id.js";

const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((value) => value.toLowerCase());
const isValidPhoneNumber = (value: string) =>
  /^[+0-9().\-\s]+$/.test(value) &&
  value.replace(/\D/g, "").length >= 7 &&
  value.replace(/\D/g, "").length <= 15;
const requiredPhoneNumberSchema = z
  .string({ error: "Укажите номер телефона." })
  .trim()
  .min(1, "Укажите номер телефона.")
  .max(32, "Номер телефона слишком длинный.")
  .refine(isValidPhoneNumber, "Введите корректный номер телефона.");
const phoneValueSchema = requiredPhoneNumberSchema.nullable();
const passwordSchema = z.string().min(8).max(128);
const registerSchema = z
  .object({
    email: emailSchema,
    displayName: z.string().trim().min(2).max(120),
    phoneNumber: requiredPhoneNumberSchema,
    password: passwordSchema,
    referralCode: referralCodeSchema,
  })
  .strict();
const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
    portal: z.enum(["CUSTOMER", "TECHNICIAN", "ADMIN", "PROCUREMENT"]),
  })
  .strict();
const yandexLoginSchema = z
  .object({
    accessToken: z.string().trim().min(20).max(4096),
    password: z.string().min(1).max(128).optional(),
    portal: z.enum(["CUSTOMER", "TECHNICIAN", "ADMIN", "PROCUREMENT"]),
    referralCode: referralCodeSchema,
  })
  .strict();
const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    newPassword: passwordSchema,
  })
  .strict();
const pushTokenSchema = z
  .object({ token: z.string().trim().min(1).max(4096) })
  .strict();
const profileSchema = z
  .object({
    phoneNumber: phoneValueSchema,
    gender: z.enum(["MALE", "FEMALE"]).nullable().optional(),
    birthDate: z
      .string()
      .date()
      .nullable()
      .optional()
      .refine(
        (value) => !value || value <= new Date().toISOString().slice(0, 10),
        {
          message: "Дата рождения не может быть в будущем.",
        },
      ),
  })
  .strict();

type Body<T> = { readonly body: T };

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as Body<T>).body;

type AuthRouterOptions = VkAuthRouterOptions & {
  readonly yandexClientId?: string | undefined;
  readonly fetchYandexIdentity?: (
    accessToken: string,
    clientId: string,
  ) => Promise<YandexIdentity>;
};

export const createAuthRouter = (
  database: DatabaseClient,
  options: AuthRouterOptions = {},
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const yandexClientId =
    options.yandexClientId ?? process.env.YANDEX_CLIENT_ID?.trim();
  const fetchYandexIdentity = options.fetchYandexIdentity ?? getYandexIdentity;
  router.use(createVkAuthRouter(database, options));

  router.post(
    "/auth/register",
    validateRequest({ body: registerSchema }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof registerSchema>>(response);
      try {
        const passwordHash = await hashPassword(input.password);
        const { user } = await database.$transaction((transaction) =>
          createCustomerWithReferral(transaction, {
            email: input.email,
            displayName: input.displayName,
            phoneNumber: input.phoneNumber,
            passwordHash,
            referralCode: input.referralCode,
          }),
        );
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

  router.post(
    "/auth/yandex",
    validateRequest({ body: yandexLoginSchema }),
    async (_request, response, next) => {
      if (!yandexClientId) {
        next(
          new HttpError(
            503,
            "YANDEX_NOT_CONFIGURED",
            "Вход через Яндекс ID пока не настроен.",
          ),
        );
        return;
      }

      const input = bodyOf<z.infer<typeof yandexLoginSchema>>(response);
      try {
        const identity = await fetchYandexIdentity(
          input.accessToken,
          yandexClientId,
        );
        let accountCreated = false;
        let referralApplied = false;
        let user = await database.user.findUnique({
          where: { yandexId: identity.id },
        });

        if (!user) {
          const emailAccount = await database.user.findUnique({
            where: { email: identity.email },
          });

          if (emailAccount) {
            if (!input.password) {
              next(
                new HttpError(
                  409,
                  "YANDEX_PASSWORD_REQUIRED",
                  "Для защиты существующего аккаунта подтвердите его паролем один раз.",
                ),
              );
              return;
            }
            if (
              !(await verifyPassword(input.password, emailAccount.passwordHash))
            ) {
              next(
                new HttpError(
                  401,
                  "INVALID_CREDENTIALS",
                  "Неверный пароль существующего аккаунта.",
                ),
              );
              return;
            }
            if (!emailAccount.active) {
              next(
                new HttpError(
                  403,
                  "ACCOUNT_DISABLED",
                  "Эта учётная запись отключена.",
                ),
              );
              return;
            }
            user = await database.user.update({
              where: { id: emailAccount.id },
              data: { yandexId: identity.id },
            });
          } else {
            if (input.portal !== "CUSTOMER") {
              next(
                new HttpError(
                  403,
                  "ROLE_MISMATCH",
                  "Новый аккаунт через Яндекс ID создаётся только для клиента.",
                ),
              );
              return;
            }
            const passwordHash = await hashPassword(
              randomBytes(32).toString("base64url"),
            );
            const created = await database.$transaction((transaction) =>
              createCustomerWithReferral(transaction, {
                email: identity.email,
                displayName: identity.displayName,
                phoneNumber: null,
                passwordHash,
                yandexId: identity.id,
                referralCode: input.referralCode,
              }),
            );
            user = created.user;
            accountCreated = true;
            referralApplied = created.referralApplied;
          }
        }

        if (!user.active) {
          next(
            new HttpError(
              403,
              "ACCOUNT_DISABLED",
              "Эта учётная запись отключена.",
            ),
          );
          return;
        }
        if (user.role !== input.portal) {
          next(
            new HttpError(
              403,
              "ROLE_MISMATCH",
              "Выберите в приложении роль, указанную для этого аккаунта.",
            ),
          );
          return;
        }

        const session = await createSession(database, user.id);
        response.json({
          accessToken: session.accessToken,
          expiresAt: session.expiresAt,
          accountCreated,
          referralApplied,
          user: publicUser(user),
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          next(
            new HttpError(
              409,
              "YANDEX_ACCOUNT_CONFLICT",
              "Не удалось связать этот Яндекс ID с аккаунтом. Войдите с прежним способом и повторите попытку.",
            ),
          );
          return;
        }
        next(error);
      }
    },
  );

  router.get("/auth/me", requireAuth, (_request, response) => {
    response.json({ user: publicUser(getAuthenticatedUser(response)) });
  });

  router.patch(
    "/auth/profile",
    requireAuth,
    validateRequest({ body: profileSchema }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { phoneNumber, gender, birthDate } =
        bodyOf<z.infer<typeof profileSchema>>(response);
      const normalizedPhoneNumber = phoneNumber?.trim() || null;
      if (user.role !== "CUSTOMER" && (gender != null || birthDate != null)) {
        throw new HttpError(
          403,
          "CUSTOMER_PROFILE_ONLY",
          "Пол и дата рождения доступны только в профиле клиента.",
        );
      }
      if (user.role === "CUSTOMER" && !normalizedPhoneNumber) {
        throw new HttpError(400, "PHONE_REQUIRED", "Укажите номер телефона.");
      }
      const updated = await database.user.update({
        where: { id: user.id },
        data: {
          phoneNumber: normalizedPhoneNumber,
          ...(user.role === "CUSTOMER" && gender !== undefined
            ? { gender }
            : {}),
          ...(user.role === "CUSTOMER" && birthDate !== undefined
            ? {
                birthDate: birthDate
                  ? new Date(`${birthDate}T00:00:00.000Z`)
                  : null,
              }
            : {}),
        },
      });
      response.json({ user: publicUser(updated) });
    },
  );

  router.put(
    "/auth/push-token",
    requireAuth,
    validateRequest({ body: pushTokenSchema }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { token } = bodyOf<z.infer<typeof pushTokenSchema>>(response);
      await database.pushDeviceToken.upsert({
        where: { token },
        create: { token, userId: user.id },
        update: { userId: user.id },
      });
      response.status(204).end();
    },
  );

  router.delete(
    "/auth/push-token",
    requireAuth,
    validateRequest({ body: pushTokenSchema }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { token } = bodyOf<z.infer<typeof pushTokenSchema>>(response);
      await database.pushDeviceToken.deleteMany({
        where: { token, userId: user.id },
      });
      response.status(204).end();
    },
  );

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
