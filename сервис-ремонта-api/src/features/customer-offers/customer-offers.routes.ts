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
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import { registerCustomerOfferAdminRoutes } from "./customer-offer-admin.routes.js";
import {
  customerOfferResponse,
  offerParams,
  paramsOf,
  participationBody,
} from "./customer-offer-contracts.js";
import { getCustomerOfferReward } from "./customer-offer-rewards.js";

const publicPrizeImageParams = z.object({
  offerId: z.string().uuid(),
  place: z.enum(["1", "2", "3"]),
});

const publicPrizeImageParamsOf = (response: { locals: { input?: unknown } }) =>
  (
    response.locals.input as {
      readonly params: z.infer<typeof publicPrizeImageParams>;
    }
  ).params;

export const createCustomerOffersRouter = (
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get("/public/offers", async (_request, response) => {
    const now = new Date();
    const [offers, completedOffers] = await Promise.all([
      database.customerOffer.findMany({
        where: {
          isPublished: true,
          type: { in: ["PROMOTION", "GIVEAWAY"] },
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: [{ endsAt: "asc" }, { startsAt: "desc" }],
        take: 20,
        select: {
          id: true,
          type: true,
          title: true,
          content: true,
          firstPlacePrize: true,
          firstPlacePrizeImageId: true,
          firstPlacePoints: true,
          secondPlacePrize: true,
          secondPlacePrizeImageId: true,
          secondPlacePoints: true,
          thirdPlacePrize: true,
          thirdPlacePrizeImageId: true,
          thirdPlacePoints: true,
          startsAt: true,
          endsAt: true,
        },
      }),
      database.customerOffer.findMany({
        where: {
          isPublished: true,
          type: { in: ["GIVEAWAY"] },
          endsAt: { lte: now },
          resultsPublishedAt: { not: null, lte: now },
          entries: { some: { place: { not: null } } },
        },
        orderBy: { endsAt: "desc" },
        take: 5,
        select: {
          id: true,
          type: true,
          title: true,
          endsAt: true,
          resultsPublishedAt: true,
          firstPlacePrize: true,
          firstPlacePrizeImageId: true,
          firstPlacePoints: true,
          secondPlacePrize: true,
          secondPlacePrizeImageId: true,
          secondPlacePoints: true,
          thirdPlacePrize: true,
          thirdPlacePrizeImageId: true,
          thirdPlacePoints: true,
          entries: {
            where: { place: { not: null } },
            orderBy: { place: "asc" },
            select: {
              place: true,
              customer: { select: { displayName: true } },
            },
          },
        },
      }),
    ]);

    response.setHeader("Cache-Control", "no-store");
    response.json({
      offers,
      completedOffers: completedOffers.map((offer) => ({
        id: offer.id,
        type: offer.type,
        title: offer.title,
        endsAt: offer.endsAt,
        resultsPublishedAt: offer.resultsPublishedAt,
        winners: offer.entries.flatMap((entry) => {
          if (entry.place === null) return [];
          const reward = getCustomerOfferReward(offer, entry.place);
          return [
            {
              place: entry.place,
              displayName: entry.customer.displayName,
              prize: reward?.prize ?? null,
              bonusPoints: reward?.bonusPoints ?? 0,
              prizeImageId:
                entry.place === 1
                  ? offer.firstPlacePrizeImageId
                  : entry.place === 2
                    ? offer.secondPlacePrizeImageId
                    : offer.thirdPlacePrizeImageId,
            },
          ];
        }),
      })),
    });
  });

  router.get(
    "/public/offers/:offerId/prizes/:place/image",
    validateRequest({ params: publicPrizeImageParams }),
    async (_request, response) => {
      const { offerId, place: placeParam } = publicPrizeImageParamsOf(response);
      const place = Number(placeParam);
      const now = new Date();
      const offer = await database.customerOffer.findFirst({
        where: {
          id: offerId,
          type: { in: ["GIVEAWAY"] },
          isPublished: true,
          OR: [
            { startsAt: { lte: now }, endsAt: { gt: now } },
            {
              endsAt: { lte: now },
              resultsPublishedAt: { not: null, lte: now },
            },
          ],
        },
        select: {
          firstPlacePrizeImageId: true,
          secondPlacePrizeImageId: true,
          thirdPlacePrizeImageId: true,
        },
      });
      const objectId = offer
        ? place === 1
          ? offer.firstPlacePrizeImageId
          : place === 2
            ? offer.secondPlacePrizeImageId
            : offer.thirdPlacePrizeImageId
        : null;
      if (!objectId) {
        throw new HttpError(404, "IMAGE_NOT_FOUND", "Фотография не найдена.");
      }

      const media = await storage.download(objectId);
      response
        .setHeader("Content-Type", media.contentType)
        .setHeader("Cache-Control", "public, max-age=60")
        .setHeader("X-Content-Type-Options", "nosniff")
        .send(media.bytes);
    },
  );

  router.get(
    "/offers",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const offers = await database.customerOffer.findMany({
        where: {
          isPublished: true,
          type: { in: ["PROMOTION", "GIVEAWAY"] },
        },
        orderBy: [{ startsAt: "desc" }, { createdAt: "desc" }],
        take: 100,
        include: {
          _count: { select: { entries: true } },
          entries: {
            where: {
              OR: [{ customerId: user.id }, { place: { not: null } }],
            },
            select: {
              id: true,
              customerId: true,
              joinedAt: true,
              place: true,
              customer: { select: { displayName: true } },
            },
          },
        },
      });
      response.json({
        offers: offers.map((offer) => customerOfferResponse(offer, user.id)),
      });
    },
  );

  router.post(
    "/offers/:offerId/participate",
    requireAuth,
    requireRoles("CUSTOMER"),
    validateRequest({ params: offerParams, body: participationBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { offerId } = paramsOf(response);
      const offer = await database.customerOffer.findUnique({
        where: { id: offerId },
        select: {
          id: true,
          type: true,
          isPublished: true,
          startsAt: true,
          endsAt: true,
        },
      });
      if (!offer) {
        throw new HttpError(404, "OFFER_NOT_FOUND", "Предложение не найдено.");
      }
      if (offer.type !== "PROMOTION" && offer.type !== "GIVEAWAY") {
        throw new HttpError(404, "OFFER_NOT_FOUND", "Предложение не найдено.");
      }

      const key = { offerId_customerId: { offerId, customerId: user.id } };
      const existing = await database.customerOfferParticipation.findUnique({
        where: key,
        select: { id: true, joinedAt: true, place: true },
      });
      if (existing) {
        response.json({ participation: existing, alreadyParticipating: true });
        return;
      }

      const now = new Date();
      if (!offer.isPublished || offer.startsAt > now || offer.endsAt <= now) {
        throw new HttpError(
          409,
          "OFFER_NOT_OPEN",
          "Сейчас запись на участие закрыта.",
        );
      }

      try {
        const participation = await database.customerOfferParticipation.create({
          data: {
            offerId,
            customerId: user.id,
          },
          select: { id: true, joinedAt: true, place: true },
        });
        response
          .status(201)
          .json({ participation, alreadyParticipating: false });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const participation =
          await database.customerOfferParticipation.findUnique({
            where: key,
            select: {
              id: true,
              joinedAt: true,
              place: true,
            },
          });
        if (!participation) throw error;
        response.json({ participation, alreadyParticipating: true });
      }
    },
  );

  registerCustomerOfferAdminRoutes(router, database, storage);
  return router;
};

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";
