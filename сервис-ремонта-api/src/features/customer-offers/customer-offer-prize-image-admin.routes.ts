import express, {
  type Request,
  type RequestHandler,
  type Router,
} from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { validateImage } from "../../lib/storage/project-images.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import { offerParams } from "./customer-offer-contracts.js";

const prizeImageBody: RequestHandler = express.raw({
  type: "image/*",
  limit: "5mb",
});

const prizeImageParams = offerParams.extend({ place: z.enum(["1", "2", "3"]) });

const prizeImageParamsOf = (response: { locals: { input?: unknown } }) =>
  (
    response.locals.input as {
      readonly params: z.infer<typeof prizeImageParams>;
    }
  ).params;

const imageOf = (request: Request) => {
  const bytes = Buffer.isBuffer(request.body) ? request.body : Buffer.alloc(0);
  return {
    bytes,
    contentType: validateImage(bytes, request.header("content-type") ?? ""),
  };
};

export const registerCustomerOfferPrizeImageAdminRoutes = (
  router: Router,
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
) => {
  const requireAuth = createRequireAuth(database);

  router.post(
    "/admin/offers/:offerId/prizes/:place/image",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: prizeImageParams }),
    prizeImageBody,
    async (request, response) => {
      const { offerId, place: placeParam } = prizeImageParamsOf(response);
      const place = Number(placeParam);
      const image = imageOf(request);
      const objectId = await storage.upload(image.bytes, image.contentType);
      let oldObjectId: string | null = null;

      try {
        await database.$transaction(async (transaction) => {
          await transaction.$queryRaw`
            SELECT "id" FROM "customer_offers" WHERE "id" = ${offerId}::uuid FOR UPDATE
          `;
          const offer = await transaction.customerOffer.findUnique({
            where: { id: offerId },
            select: {
              id: true,
              type: true,
              firstPlacePrizeImageId: true,
              secondPlacePrizeImageId: true,
              thirdPlacePrizeImageId: true,
            },
          });
          if (!offer) {
            throw new HttpError(404, "OFFER_NOT_FOUND", "Розыгрыш не найден.");
          }
          if (offer.type !== "GIVEAWAY") {
            throw new HttpError(
              409,
              "OFFER_HAS_NO_PRIZES",
              "Фотографии можно добавить только к призам розыгрыша.",
            );
          }
          oldObjectId =
            place === 1
              ? offer.firstPlacePrizeImageId
              : place === 2
                ? offer.secondPlacePrizeImageId
                : offer.thirdPlacePrizeImageId;
          const imageData =
            place === 1
              ? { firstPlacePrizeImageId: objectId }
              : place === 2
                ? { secondPlacePrizeImageId: objectId }
                : { thirdPlacePrizeImageId: objectId };
          await transaction.customerOffer.update({
            where: { id: offerId },
            data: imageData,
          });
        });
      } catch (error) {
        await storage.delete(objectId).catch(() => undefined);
        throw error;
      }

      if (oldObjectId && oldObjectId !== objectId) {
        await storage.delete(oldObjectId).catch(() => undefined);
      }
      response.status(201).json({ objectId, place });
    },
  );

  router.delete(
    "/admin/offers/:offerId/prizes/:place/image",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: prizeImageParams }),
    async (_request, response) => {
      const { offerId, place: placeParam } = prizeImageParamsOf(response);
      const place = Number(placeParam);
      const updated = await database.$transaction(async (transaction) => {
        await transaction.$queryRaw`
          SELECT "id" FROM "customer_offers" WHERE "id" = ${offerId}::uuid FOR UPDATE
        `;
        const offer = await transaction.customerOffer.findUnique({
          where: { id: offerId },
          select: {
            id: true,
            type: true,
            firstPlacePrizeImageId: true,
            secondPlacePrizeImageId: true,
            thirdPlacePrizeImageId: true,
          },
        });
        if (!offer) {
          throw new HttpError(404, "OFFER_NOT_FOUND", "Розыгрыш не найден.");
        }
        if (offer.type !== "GIVEAWAY") {
          throw new HttpError(
            409,
            "OFFER_HAS_NO_PRIZES",
            "Фотографии можно добавить только к призам розыгрыша.",
          );
        }
        const oldObjectId =
          place === 1
            ? offer.firstPlacePrizeImageId
            : place === 2
              ? offer.secondPlacePrizeImageId
              : offer.thirdPlacePrizeImageId;
        if (!oldObjectId) {
          throw new HttpError(
            404,
            "OFFER_PRIZE_IMAGE_NOT_FOUND",
            "Фотография приза не найдена.",
          );
        }
        const imageData =
          place === 1
            ? { firstPlacePrizeImageId: null }
            : place === 2
              ? { secondPlacePrizeImageId: null }
              : { thirdPlacePrizeImageId: null };
        await transaction.customerOffer.update({
          where: { id: offerId },
          data: imageData,
        });
        return oldObjectId;
      });
      await storage.delete(updated).catch(() => undefined);
      response.status(204).end();
    },
  );
};
