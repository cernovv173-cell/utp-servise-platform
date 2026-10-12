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

const deviceIdParams = z.object({ deviceId: z.string().uuid() });
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
  deviceType: z.enum(["COMPUTER", "LAPTOP", "PHONE", "TABLET"]),
  nickname: z.string().trim().max(120).nullable().optional(),
  brand: z.string().trim().max(120).nullable().optional(),
  model: z.string().trim().max(160).nullable().optional(),
  serialNumber: z.string().trim().max(160).nullable().optional(),
  nextMaintenanceAt: dateOnly.nullable().optional(),
  maintenanceNote: z.string().trim().max(250).nullable().optional(),
};

const createDeviceBody = z.object(deviceFields).strict();
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

  router.get(
    "/customer/devices",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const devices = await database.customerDevice.findMany({
        where: { customerId: user.id },
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
      const device = await database.customerDevice.create({
        data: {
          customerId: user.id,
          deviceType: body.deviceType,
          nickname: body.nickname || null,
          brand: body.brand || null,
          model: body.model || null,
          serialNumber: body.serialNumber || null,
          nextMaintenanceAt: parseDate(body.nextMaintenanceAt),
          maintenanceNote: body.maintenanceNote || null,
        },
      });
      response.status(201).json({ device: { ...device, repairOrders: [] } });
    },
  );

  router.patch(
    "/customer/devices/:deviceId",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: deviceIdParams, body: updateDeviceBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { deviceId } = (
        response.locals.input as { params: z.infer<typeof deviceIdParams> }
      ).params;
      const body = (
        response.locals.input as { body: z.infer<typeof updateDeviceBody> }
      ).body;
      const current = await database.customerDevice.findFirst({
        where: { id: deviceId, customerId: user.id },
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
    validateRequest({ params: deviceIdParams }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { deviceId } = (
        response.locals.input as { params: z.infer<typeof deviceIdParams> }
      ).params;
      const deleted = await database.customerDevice.deleteMany({
        where: { id: deviceId, customerId: user.id },
      });
      if (deleted.count === 0)
        throw new HttpError(404, "DEVICE_NOT_FOUND", "Техника не найдена.");
      response.status(204).end();
    },
  );

  return router;
};
