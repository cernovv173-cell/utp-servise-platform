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
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import { generateTemporaryPassword, hashPassword } from "../auth/passwords.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import { deleteCustomerAndData } from "./customer-deletion.js";

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
    email: emailSchema,
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

  router.post(
    "/admin/customers",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ body: createCustomerBody }),
    async (_request, response, next) => {
      const input = bodyOf<z.infer<typeof createCustomerBody>>(response);
      const temporaryPassword = generateTemporaryPassword();
      try {
        const customer = await database.user.create({
          data: {
            email: input.email,
            displayName: input.displayName,
            phoneNumber: input.phoneNumber?.trim() || null,
            role: "CUSTOMER",
            passwordHash: await hashPassword(temporaryPassword),
            mustChangePassword: true,
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
        response.status(201).json({ customer, temporaryPassword });
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
            displayName: true,
            phoneNumber: true,
            active: true,
            createdAt: true,
          },
          orderBy: [{ displayName: "asc" }, { createdAt: "desc" }],
          ...getPaginationRange({ page, pageSize }),
        }),
        database.user.count({ where }),
      ]);
      response.json({
        customers,
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
