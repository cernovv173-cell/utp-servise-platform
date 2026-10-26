import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createCustomerWithReferral } from "../referrals/customer-registration.js";
import { referralCodeSchema } from "../referrals/referral-code.js";
import { publicUser } from "./auth.middleware.js";
import { hashPassword, verifyPassword } from "./passwords.js";
import { createSession, isUniqueViolation } from "./session.js";
import { type VkIdentity, getVkIdentity } from "./vk-id.js";

const vkLoginSchema = z
  .object({
    accessToken: z.string().trim().min(20).max(4096),
    password: z.string().min(1).max(128).optional(),
    portal: z.enum(["CUSTOMER", "TECHNICIAN", "ADMIN", "PROCUREMENT"]),
    referralCode: referralCodeSchema,
  })
  .strict();

export type VkAuthRouterOptions = {
  readonly vkAppId?: string | undefined;
  readonly fetchVkIdentity?: (
    accessToken: string,
    appId: string,
  ) => Promise<VkIdentity>;
};

type Body<T> = { readonly body: T };
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as Body<T>).body;

export const createVkAuthRouter = (
  database: DatabaseClient,
  options: VkAuthRouterOptions = {},
): Router => {
  const router = Router();
  const appId = options.vkAppId ?? process.env.VK_ID_APP_ID?.trim();
  const fetchIdentity = options.fetchVkIdentity ?? getVkIdentity;

  router.post(
    "/auth/vk",
    validateRequest({ body: vkLoginSchema }),
    async (_request, response, next) => {
      if (!appId) {
        next(
          new HttpError(
            503,
            "VK_NOT_CONFIGURED",
            "Вход через VK ID пока не настроен.",
          ),
        );
        return;
      }
      const input = bodyOf<z.infer<typeof vkLoginSchema>>(response);
      try {
        const identity = await fetchIdentity(input.accessToken, appId);
        let accountCreated = false;
        let referralApplied = false;
        let user = await database.user.findUnique({
          where: { vkId: identity.id },
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
                  "VK_PASSWORD_REQUIRED",
                  "Для защиты существующего аккаунта подтвердите его пароль один раз.",
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
              data: { vkId: identity.id },
            });
          } else {
            if (input.portal !== "CUSTOMER") {
              next(
                new HttpError(
                  403,
                  "ROLE_MISMATCH",
                  "Новый аккаунт через VK ID создаётся только для клиента.",
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
                vkId: identity.id,
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
              "VK_ACCOUNT_CONFLICT",
              "Не удалось связать этот VK ID с аккаунтом. Войдите прежним способом и повторите попытку.",
            ),
          );
          return;
        }
        next(error);
      }
    },
  );

  return router;
};
