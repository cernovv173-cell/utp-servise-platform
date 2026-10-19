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
import { canAccessCraftOrderChat } from "../crafts/craft-chat-policy.js";
import { canViewRepairOrder } from "../orders/order-policy.js";
import { type MediaStorage, projectMediaStorage } from "./media-storage.js";

const mediaParams = z.object({ objectId: z.string().trim().min(1).max(255) });

const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const invalidMedia = (): never => {
  throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
};

export const createProtectedMediaRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const allowedRoles = requireRoles("CUSTOMER", "TECHNICIAN", "ADMIN");

  router.get(
    "/media/:objectId",
    requireAuth,
    allowedRoles,
    validateRequest({ params: mediaParams }),
    async (_request, response) => {
      const { objectId } = paramsOf<z.infer<typeof mediaParams>>(response);
      const user = getAuthenticatedUser(response);
      const avatarOwner = await database.user.findFirst({
        where: { avatarObjectId: objectId },
        select: { id: true, role: true },
      });

      if (avatarOwner) {
        let mayView = user.role === "ADMIN" || user.id === avatarOwner.id;
        if (
          !mayView &&
          user.role === "CUSTOMER" &&
          avatarOwner.role === "TECHNICIAN"
        ) {
          mayView = Boolean(
            await database.repairOrder.findFirst({
              where: {
                customerId: user.id,
                assignedTechnicianId: avatarOwner.id,
              },
              select: { id: true },
            }),
          );
        }
        if (
          !mayView &&
          user.role === "TECHNICIAN" &&
          avatarOwner.role === "CUSTOMER"
        ) {
          mayView = Boolean(
            await database.repairOrder.findFirst({
              where: {
                customerId: avatarOwner.id,
                assignedTechnicianId: user.id,
              },
              select: { id: true },
            }),
          );
        }
        if (!mayView) invalidMedia();
      } else {
        const now = new Date();
        const review = await database.review.findFirst({
          where: {
            AND: [
              {
                OR: [
                  { imageObjectId: objectId },
                  { clientPhotoObjectId: objectId },
                  { workPhotoObjectId: objectId },
                ],
              },
              ...(user.role === "ADMIN"
                ? []
                : [{ OR: [{ isPublished: true }, { customerId: user.id }] }]),
            ],
          },
          select: { id: true },
        });
        if (!review) {
          const article = await database.newsArticle.findFirst({
            where: {
              imageObjectId: objectId,
              ...(user.role === "ADMIN"
                ? {}
                : {
                    isPublished: true,
                    AND: [
                      { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
                      { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                    ],
                  }),
            },
            select: { id: true },
          });
          if (!article) {
            const craftItem = await database.craftItem.findFirst({
              where: {
                imageObjectId: objectId,
                ...(user.role === "ADMIN" ? {} : { isPublished: true }),
              },
              select: { id: true },
            });
            if (!craftItem) {
              const banner = await database.siteBanner.findFirst({
                where: {
                  imageObjectId: objectId,
                  ...(user.role === "ADMIN"
                    ? {}
                    : {
                        isActive: true,
                        AND: [
                          {
                            OR: [
                              { startsAt: null },
                              { startsAt: { lte: now } },
                            ],
                          },
                          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
                        ],
                      }),
                },
                select: { id: true },
              });
              if (!banner) {
                const craftMessage =
                  await database.craftOrderChatMessage.findFirst({
                    where: { imageObjectId: objectId },
                    select: { craftOrder: { select: { customerId: true } } },
                  });
                if (craftMessage) {
                  if (
                    !canAccessCraftOrderChat(
                      user.role,
                      user.id,
                      craftMessage.craftOrder,
                    )
                  )
                    invalidMedia();
                } else {
                  const photo = await database.repairOrderPhoto.findUnique({
                    where: { objectId },
                    select: {
                      order: {
                        select: {
                          customerId: true,
                          assignedTechnicianId: true,
                        },
                      },
                    },
                  });
                  if (photo) {
                    if (!canViewRepairOrder(user.role, user.id, photo.order))
                      invalidMedia();
                  } else {
                    const intake = await database.repairOrderIntake.findFirst({
                      where: {
                        OR: [
                          { frontPhotoObjectId: objectId },
                          { backPhotoObjectId: objectId },
                          { leftPhotoObjectId: objectId },
                          { rightPhotoObjectId: objectId },
                        ],
                      },
                      select: {
                        order: {
                          select: {
                            customerId: true,
                            assignedTechnicianId: true,
                          },
                        },
                      },
                    });
                    if (
                      !intake ||
                      !canViewRepairOrder(user.role, user.id, intake.order)
                    )
                      invalidMedia();
                  }
                }
              }
            }
          }
        }
      }

      const image = await storage.download(objectId);
      response
        .setHeader("Content-Type", image.contentType)
        .setHeader("Cache-Control", "private, max-age=300")
        .setHeader("X-Content-Type-Options", "nosniff")
        .send(image.bytes);
    },
  );

  return router;
};
