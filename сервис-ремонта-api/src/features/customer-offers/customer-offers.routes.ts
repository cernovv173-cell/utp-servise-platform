import { Router } from "express";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { registerCustomerOfferAdminRoutes } from "./customer-offer-admin.routes.js";
import {
  bodyOf,
  customerOfferResponse,
  offerParams,
  paramsOf,
  participationBody,
} from "./customer-offer-contracts.js";
import { getCustomerOfferReward } from "./customer-offer-rewards.js";

export const createCustomerOffersRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get("/public/offers", async (_request, response) => {
    const now = new Date();
    const [offers, completedOffers] = await Promise.all([
      database.customerOffer.findMany({
        where: {
          isPublished: true,
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
          firstPlacePoints: true,
          secondPlacePrize: true,
          secondPlacePoints: true,
          thirdPlacePrize: true,
          thirdPlacePoints: true,
          startsAt: true,
          endsAt: true,
        },
      }),
      database.customerOffer.findMany({
        where: {
          isPublished: true,
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
          firstPlacePoints: true,
          secondPlacePrize: true,
          secondPlacePoints: true,
          thirdPlacePrize: true,
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
            },
          ];
        }),
      })),
    });
  });

  router.get(
    "/offers",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const offers = await database.customerOffer.findMany({
        where: { isPublished: true },
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
              answerIndex: true,
              answerCorrect: true,
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
      const { answerIndex } = bodyOf<{ answerIndex?: number }>(response);
      const offer = await database.customerOffer.findUnique({
        where: { id: offerId },
        select: {
          id: true,
          type: true,
          isPublished: true,
          startsAt: true,
          endsAt: true,
          quizOptions: true,
          quizCorrectOption: true,
        },
      });
      if (!offer) {
        throw new HttpError(404, "OFFER_NOT_FOUND", "Предложение не найдено.");
      }
      if (offer.type === "QUIZ") {
        if (answerIndex === undefined) {
          throw new HttpError(
            400,
            "QUIZ_ANSWER_REQUIRED",
            "Выберите вариант ответа.",
          );
        }
        if (answerIndex >= offer.quizOptions.length) {
          throw new HttpError(
            400,
            "QUIZ_ANSWER_INVALID",
            "Выберите один из вариантов ответа.",
          );
        }
      } else if (answerIndex !== undefined) {
        throw new HttpError(
          400,
          "NOT_A_QUIZ",
          "Ответ можно отправить только в квизе.",
        );
      }

      const key = { offerId_customerId: { offerId, customerId: user.id } };
      const existing = await database.customerOfferParticipation.findUnique({
        where: key,
        select: { id: true, joinedAt: true, place: true, answerIndex: true },
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
            answerIndex: offer.type === "QUIZ" ? answerIndex : null,
            answerCorrect:
              offer.type === "QUIZ" && offer.quizCorrectOption !== null
                ? answerIndex === offer.quizCorrectOption
                : null,
          },
          select: { id: true, joinedAt: true, place: true, answerIndex: true },
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
              answerIndex: true,
            },
          });
        if (!participation) throw error;
        response.json({ participation, alreadyParticipating: true });
      }
    },
  );

  registerCustomerOfferAdminRoutes(router, database);
  return router;
};

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";
