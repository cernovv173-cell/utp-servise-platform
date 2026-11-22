import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { supportedRepairDeviceTypes } from "../catalog/repair-device-types.js";

const deviceIdParams = z.object({ deviceId: z.string().uuid() });
const deviceScopeQuery = z
  .object({ scope: z.enum(["personal", "business"]).optional() })
  .strict();
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/u)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });

const deviceFields = {
  deviceType: z.enum(supportedRepairDeviceTypes),
  nickname: z.string().trim().max(120).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  serialNumber: z.string().trim().max(160).nullable().optional(),
  nextMaintenanceAt: dateOnly.nullable().optional(),
  maintenanceNote: z.string().trim().max(250).nullable().optional(),
};

const createDeviceBody = z
  .object({
    ...deviceFields,
    scope: z.enum(["personal", "business"]).optional(),
  })
  .strict();
const updateDeviceBody = z
  .object(deviceFields)
  .partial()
  .strict()
  .refine((body) => Object.keys(body).length > 0);

const parseDate = (
  value: string | null | undefined,
): Date | null | undefined =>
  value === undefined
    ? undefined
    : value === null
      ? null
      : new Date(`${value}T00:00:00.000Z`);

export const createCustomerDevicesRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const getBusinessProfileId = async (customerId: string) => {
    const profile = await database.customerBusinessProfile.findUnique({
      where: { ownerUserId: customerId },
      select: { id: true },
    });
    return profile?.id ?? null;
  };
  const requireBusinessProfileId = async (customerId: string) => {
    const profileId = await getBusinessProfileId(customerId);
    if (!profileId) {
      throw new HttpError(
        404,
        "BUSINESS_PROFILE_NOT_FOUND",
        "Профиль компании не найден.",
      );
    }
    return profileId;
  };

  router.get(
    "/customer/devices",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ query: deviceScopeQuery }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { scope = "personal" } = (
        response.locals.input as { query: z.infer<typeof deviceScopeQuery> }
      ).query;
      const businessProfileId =
        scope === "business" ? await getBusinessProfileId(user.id) : null;
      if (scope === "business" && !businessProfileId) {
        response.json({ devices: [] });
        return;
      }
      const devices = await database.customerDevice.findMany({
        where: { customerId: user.id, businessProfileId },
        include: {
          repairOrders: {
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              serviceNumber: true,
              deviceType: true,
              problem: true,
              status: true,
              createdAt: true,
              warranty: { select: { warrantyNumber: true, expiresAt: true } },
              warrantyOriginOrder: {
                select: { id: true, serviceNumber: true },
              },
              receipt: { select: { receiptNumber: true, issuedAt: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });
      response.json({ devices });
    },
  );

  router.post(
    "/customer/devices",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ body: createDeviceBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const body = (
        response.locals.input as { body: z.infer<typeof createDeviceBody> }
      ).body;
      const { scope = "personal", ...fields } = body;
      const businessProfileId =
        scope === "business" ? await requireBusinessProfileId(user.id) : null;
      const device = await database.customerDevice.create({
        data: {
          customerId: user.id,
          businessProfileId,
          deviceType: fields.deviceType,
          nickname: fields.nickname || null,
          brand: fields.brand || null,
          model: fields.model || null,
          serialNumber: fields.serialNumber || null,
          nextMaintenanceAt: parseDate(fields.nextMaintenanceAt),
          maintenanceNote: fields.maintenanceNote || null,
        },
      });
      response.status(201).json({ device: { ...device, repairOrders: [] } });
    },
  );

  router.patch(
    "/customer/devices/:deviceId",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({
      params: deviceIdParams,
      query: deviceScopeQuery,
      body: updateDeviceBody,
    }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { scope = "personal" } = (
        response.locals.input as { query: z.infer<typeof deviceScopeQuery> }
      ).query;
      const { deviceId } = (
        response.locals.input as { params: z.infer<typeof deviceIdParams> }
      ).params;
      const businessProfileId =
        scope === "business" ? await requireBusinessProfileId(user.id) : null;
      const body = (
        response.locals.input as { body: z.infer<typeof updateDeviceBody> }
      ).body;
      const current = await database.customerDevice.findFirst({
        where: { id: deviceId, customerId: user.id, businessProfileId },
        select: { id: true },
      });
      if (!current)
        throw new HttpError(404, "DEVICE_NOT_FOUND", "Техника не найдена.");
      const device = await database.customerDevice.update({
        where: { id: deviceId },
        data: {
          ...body,
          nextMaintenanceAt: parseDate(body.nextMaintenanceAt),
          nickname: body.nickname === "" ? null : body.nickname,
          brand: body.brand === "" ? null : body.brand,
          model: body.model === "" ? null : body.model,
          serialNumber: body.serialNumber === "" ? null : body.serialNumber,
          maintenanceNote:
            body.maintenanceNote === "" ? null : body.maintenanceNote,
        },
      });
      response.json({ device });
    },
  );

  router.delete(
    "/customer/devices/:deviceId",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: deviceIdParams, query: deviceScopeQuery }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { scope = "personal" } = (
        response.locals.input as { query: z.infer<typeof deviceScopeQuery> }
      ).query;
      const { deviceId } = (
        response.locals.input as { params: z.infer<typeof deviceIdParams> }
      ).params;
      const businessProfileId =
        scope === "business" ? await requireBusinessProfileId(user.id) : null;
      const deleted = await database.customerDevice.deleteMany({
        where: { id: deviceId, customerId: user.id, businessProfileId },
      });
      if (deleted.count === 0)
        throw new HttpError(404, "DEVICE_NOT_FOUND", "Техника не найдена.");
      response.status(204).end();
    },
  );

  return router;
};
