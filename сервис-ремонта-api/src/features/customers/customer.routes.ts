import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  createPaginatedResponse,
  getPaginationRange,
  paginationQuerySchema,
} from "../../lib/http/pagination.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import {
  generateAccountLogin,
  generateTemporaryPassword,
  hashPassword,
} from "../auth/passwords.js";
import {
  findCustomersByNationalPhone,
  startMaxLogin,
} from "../max/max-login.service.js";
import { normalizeMaxPhone } from "../max/max-phone.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import { deleteCustomerAndData } from "./customer-deletion.js";
import { createCustomerWithTemporaryLogin } from "./customer-login-credentials.js";

const customerQuery = paginationQuerySchema.extend({
  search: z.string().trim().max(120).default(""),
});
const customerIdParams = z.object({ customerId: z.string().uuid() });
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
const updateCustomerBody = z
  .object({
    email: emailSchema.optional(),
    displayName: z.string().trim().min(2).max(120).optional(),
    phoneNumber: phoneNumberSchema,
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0);
const createCustomerBody = z
  .object({
    email: emailSchema.nullable().optional(),
    displayName: z.string().trim().min(2).max(120),
    phoneNumber: phoneNumberSchema,
  })
  .strict();

const queryOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly query: T }).query;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;
const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;

const isUniqueViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const isForeignKeyViolation = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  (error.code === "P2003" || error.code === "23503");

export const createCustomerAdminRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.delete(
    "/customer/account",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response, next) => {
      const { id: customerId } = getAuthenticatedUser(response);
      try {
        await deleteCustomerAndData(database, storage, customerId, {
          disableAccountBeforeCleanup: false,
        });
        response.json({ deleted: true });
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          next(
            new HttpError(
              409,
              "CUSTOMER_DELETE_BLOCKED",
              "Не удалось удалить все связанные записи. Повторите попытку позже.",
            ),
          );
          return;
        }
        next(error);
      }
    },
  );

  router.post(
    "/admin/customers/:customerId/max-activation",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: customerIdParams }),
    async (_request, response) => {
      const { customerId } =
        paramsOf<z.infer<typeof customerIdParams>>(response);
      const customer = await database.user.findFirst({
        where: {
          id: customerId,
          role: "CUSTOMER",
          active: true,
          email: null,
        },
        select: { id: true },
      });
      if (!customer) {
        throw new HttpError(
          404,
          "CUSTOMER_NOT_FOUND",
          "Клиент без электронной почты не найден.",
        );
      }
      const activation = await startMaxLogin(database, undefined, customer.id);
      response.status(201).json({
        url: activation.url,
        expiresAt: activation.expiresAt,
      });
    },
  );

  router.post(
    "/admin/customers",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: createCustomerBody }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof createCustomerBody>>(response);
      const phoneNumber = input.phoneNumber?.trim() || null;

      if (!input.email) {
        const normalizedPhone = phoneNumber
          ? normalizeMaxPhone(phoneNumber)
          : null;
        if (!normalizedPhone) {
          next(
            new HttpError(
              400,
              "CUSTOMER_PHONE_REQUIRED",
              "Без электронной почты укажите полный номер телефона, привязанный к МАКС.",
            ),
          );
          return;
        }

        try {
          const customer = await database.$transaction(async (transaction) => {
            const matches = await findCustomersByNationalPhone(
              transaction,
              normalizedPhone.nationalDigits,
            );
            if (matches.length > 0) {
              throw new HttpError(
                409,
                "CUSTOMER_PHONE_IN_USE",
                "Клиент с таким номером уже есть в базе. Найдите его и выберите вместо создания нового.",
              );
            }
            const created = await createCustomerWithTemporaryLogin(
              transaction,
              {
                displayName: input.displayName,
                phoneNumber: normalizedPhone.phone,
              },
            );
            return created.customer;
          });
          const { maxUserId, ...publicCustomer } = customer;
          response.status(201).json({
            customer: { ...publicCustomer, maxLinked: Boolean(maxUserId) },
            credentialDelivery: { channel: "MAX", status: "PENDING" },
          });
        } catch (error) {
          if (isUniqueViolation(error)) {
            next(
              new HttpError(
                409,
                "CUSTOMER_LOGIN_CONFLICT",
                "Не удалось создать логин клиента. Повторите попытку.",
              ),
            );
          } else {
            next(error);
          }
        }
        return;
      }

      const temporaryPassword = generateTemporaryPassword();
      const login = generateAccountLogin();
      try {
        const customer = await database.user.create({
          data: {
            email: input.email,
            login,
            displayName: input.displayName,
            phoneNumber,
            role: "CUSTOMER",
            passwordHash: await hashPassword(temporaryPassword),
            mustChangePassword: true,
          },
          select: {
            id: true,
            email: true,
            displayName: true,
            phoneNumber: true,
            login: true,
            maxUserId: true,
            active: true,
            createdAt: true,
          },
        });
        const { maxUserId, ...publicCustomer } = customer;
        response.status(201).json({
          customer: { ...publicCustomer, maxLinked: Boolean(maxUserId) },
          temporaryPassword,
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

  router.get(
    "/admin/customers",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ query: customerQuery }),
    async (_request, response) => {
      const { page, pageSize, search } =
        queryOf<z.infer<typeof customerQuery>>(response);
      const where = {
        role: "CUSTOMER" as const,
        ...(search
          ? {
              OR: [
                {
                  displayName: {
                    contains: search,
                    mode: "insensitive" as const,
                  },
                },
                { email: { contains: search, mode: "insensitive" as const } },
                { login: { contains: search, mode: "insensitive" as const } },
                { phoneNumber: { contains: search } },
              ],
            }
          : {}),
      };
      const [customers, totalItems] = await Promise.all([
        database.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            login: true,
            displayName: true,
            phoneNumber: true,
            maxUserId: true,
            active: true,
            createdAt: true,
          },
          orderBy: [{ displayName: "asc" }, { createdAt: "desc" }],
          ...getPaginationRange({ page, pageSize }),
        }),
        database.user.count({ where }),
      ]);
      response.json({
        customers: customers.map((customer) => {
          const { maxUserId, ...publicCustomer } = customer;
          return { ...publicCustomer, maxLinked: Boolean(maxUserId) };
        }),
        pagination: createPaginatedResponse(customers, totalItems, {
          page,
          pageSize,
        }).pagination,
      });
    },
  );

  router.patch(
    "/admin/customers/:customerId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: customerIdParams, body: updateCustomerBody }),
    async (_request, response, next) => {
      const { customerId } =
        paramsOf<z.infer<typeof customerIdParams>>(response);
      const input = bodyOf<z.infer<typeof updateCustomerBody>>(response);
      const customer = await database.user.findFirst({
        where: { id: customerId, role: "CUSTOMER" },
        select: { id: true },
      });
      if (!customer) {
        next(new HttpError(404, "CUSTOMER_NOT_FOUND", "Клиент не найден."));
        return;
      }
      try {
        const updatedCustomer = await database.user.update({
          where: { id: customer.id },
          data: {
            email: input.email,
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
            active: true,
            createdAt: true,
          },
        });
        response.json({ customer: updatedCustomer });
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

  router.delete(
    "/admin/customers/:customerId",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: customerIdParams }),
    async (_request, response, next) => {
      const { customerId } =
        paramsOf<z.infer<typeof customerIdParams>>(response);
      try {
        const customer = await deleteCustomerAndData(
          database,
          storage,
          customerId,
        );
        response.json({ customer });
      } catch (error) {
        if (isForeignKeyViolation(error)) {
          next(
            new HttpError(
              409,
              "CUSTOMER_DELETE_BLOCKED",
              "Не удалось удалить все записи клиента. Учётная запись отключена; повторите попытку позже.",
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
