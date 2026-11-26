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
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireStaffPermission,
} from "../auth/auth.middleware.js";
import {
  type MediaStorage,
  projectMediaStorage,
} from "../media/media-storage.js";
import {
  adminOfferInclude,
  adminOfferResponse,
  bodyOf,
  createOfferBody,
  offerParams,
  paramsOf,
  updateOfferBody,
} from "./customer-offer-contracts.js";
import { registerCustomerOfferPrizeImageAdminRoutes } from "./customer-offer-prize-image-admin.routes.js";
import { scheduleCustomerOfferPush } from "./customer-offer-push-delivery.js";
import {
  getConfiguredCustomerOfferRewardCount,
  getCustomerOfferReward,
} from "./customer-offer-rewards.js";
import { scheduleCustomerOfferWinnerPush } from "./customer-offer-winner-push-delivery.js";
import { selectRandomWinners } from "./winner-selection.js";

const prizeImageIds = (offer: {
  firstPlacePrizeImageId: string | null;
  secondPlacePrizeImageId: string | null;
  thirdPlacePrizeImageId: string | null;
}) =>
  [
    offer.firstPlacePrizeImageId,
    offer.secondPlacePrizeImageId,
    offer.thirdPlacePrizeImageId,
  ].filter((objectId): objectId is string => Boolean(objectId));

export const registerCustomerOfferAdminRoutes = (
  router: Router,
  database: DatabaseClient,
  storage: MediaStorage = projectMediaStorage,
) => {
  const requireAuth = createRequireAuth(database);
  registerCustomerOfferPrizeImageAdminRoutes(router, database, storage);

  router.get(
    "/admin/offers",
    requireAuth,
    requireStaffPermission("content"),
    async (_request, response) => {
      const offers = await database.customerOffer.findMany({
        where: { type: { in: ["PROMOTION", "GIVEAWAY"] } },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: adminOfferInclude,
      });
      response.json({ offers: offers.map(adminOfferResponse) });
    },
  );

  router.post(
    "/admin/offers",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ body: createOfferBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<ReturnType<typeof createOfferBody.parse>>(response);
      const isPrizeOffer = input.type === "GIVEAWAY";
      const offer = await database.$transaction(async (transaction) => {
        const created = await transaction.customerOffer.create({
          data: {
            type: input.type,
            title: input.title,
            content: input.content,
            firstPlacePrize: isPrizeOffer
              ? input.firstPlacePrize?.trim() || null
              : null,
            firstPlacePoints: isPrizeOffer ? input.firstPlacePoints : 0,
            secondPlacePrize: isPrizeOffer
              ? input.secondPlacePrize?.trim() || null
              : null,
            secondPlacePoints: isPrizeOffer ? input.secondPlacePoints : 0,
            thirdPlacePrize: isPrizeOffer
              ? input.thirdPlacePrize?.trim() || null
              : null,
            thirdPlacePoints: isPrizeOffer ? input.thirdPlacePoints : 0,
            startsAt: new Date(input.startsAt),
            endsAt: new Date(input.endsAt),
            isPublished: input.isPublished,
            createdById: user.id,
          },
        });
        if (created.isPublished) {
          await scheduleCustomerOfferPush(transaction, created.id);
        }
        return created;
      });
      response.status(201).json({ offer });
    },
  );

  router.patch(
    "/admin/offers/:offerId",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: offerParams, body: updateOfferBody }),
    async (_request, response) => {
      const { offerId } = paramsOf(response);
      const input = bodyOf<ReturnType<typeof updateOfferBody.parse>>(response);
      const offer = await database.$transaction(async (transaction) => {
        const current = await transaction.customerOffer.findUnique({
          where: { id: offerId },
          select: { id: true, isPublished: true },
        });
        if (!current) {
          throw new HttpError(
            404,
            "OFFER_NOT_FOUND",
            "Акция или розыгрыш не найдены.",
          );
        }
        const updated = await transaction.customerOffer.update({
          where: { id: offerId },
          data: { isPublished: input.isPublished },
        });
        if (!current.isPublished && updated.isPublished) {
          await scheduleCustomerOfferPush(transaction, updated.id);
        } else if (current.isPublished && !updated.isPublished) {
          await transaction.customerOfferPushDelivery.deleteMany({
            where: { offerId, sentAt: null },
          });
        }
        return updated;
      });
      response.json({ offer });
    },
  );

  router.delete(
    "/admin/offers/:offerId",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: offerParams }),
    async (_request, response) => {
      const { offerId } = paramsOf(response);
      const existing = await database.customerOffer.findUnique({
        where: { id: offerId },
        select: {
          id: true,
          firstPlacePrizeImageId: true,
          secondPlacePrizeImageId: true,
          thirdPlacePrizeImageId: true,
        },
      });
      if (!existing) {
        throw new HttpError(
          404,
          "OFFER_NOT_FOUND",
          "Акция или розыгрыш не найдены.",
        );
      }
      const deleted = await database.customerOffer.deleteMany({
        where: { id: offerId },
      });
      if (deleted.count === 0) {
        throw new HttpError(
          404,
          "OFFER_NOT_FOUND",
          "Акция или розыгрыш не найдены.",
        );
      }
      await Promise.all(
        prizeImageIds(existing).map((objectId) =>
          storage.delete(objectId).catch(() => undefined),
        ),
      );
      response.status(204).end();
    },
  );

  router.post(
    "/admin/offers/:offerId/draw",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: offerParams }),
    async (_request, response) => {
      const { offerId } = paramsOf(response);
      const result = await database.$transaction(async (transaction) => {
        const offer = await transaction.customerOffer.findUnique({
          where: { id: offerId },
        });
        if (!offer) {
          throw new HttpError(
            404,
            "OFFER_NOT_FOUND",
            "Предложение не найдено.",
          );
        }
        if (offer.type !== "GIVEAWAY") {
          throw new HttpError(
            409,
            "NOT_A_PRIZE_OFFER",
            "Победителей можно выбрать только в розыгрыше.",
          );
        }
        if (offer.drawnAt) {
          throw new HttpError(
            409,
            "GIVEAWAY_ALREADY_DRAWN",
            "Победители уже выбраны.",
          );
        }
        if (offer.endsAt > new Date()) {
          throw new HttpError(
            409,
            "GIVEAWAY_NOT_ENDED",
            "Выбрать победителей можно после окончания приёма участников.",
          );
        }

        const entries = await transaction.customerOfferParticipation.findMany({
          where: { offerId },
          select: { id: true, customerId: true },
        });
        const rewardPlacesCount = getConfiguredCustomerOfferRewardCount(offer);
        if (rewardPlacesCount === 0) {
          throw new HttpError(
            409,
            "GIVEAWAY_NO_CONFIGURED_REWARDS",
            "Укажите награду хотя бы для одного места перед жеребьёвкой.",
          );
        }
        if (entries.length < rewardPlacesCount) {
          throw new HttpError(
            409,
            "GIVEAWAY_NEEDS_ENOUGH_ENTRIES",
            `Для розыгрыша ${rewardPlacesCount} мест нужно не менее ${rewardPlacesCount} участников.`,
          );
        }

        const winnersCount = Math.min(rewardPlacesCount, entries.length);
        const winners = selectRandomWinners(entries, winnersCount);
        const drawnAt = new Date();
        const claimed = await transaction.customerOffer.updateMany({
          where: { id: offerId, drawnAt: null },
          data: { drawnAt },
        });
        if (claimed.count !== 1) {
          throw new HttpError(
            409,
            "GIVEAWAY_ALREADY_DRAWN",
            "Победители уже выбраны.",
          );
        }
        for (const [index, winner] of winners.entries()) {
          await transaction.customerOfferParticipation.updateMany({
            where: { id: winner.id, offerId, place: null },
            data: { place: index + 1 },
          });
        }
        const updatedOffer = await transaction.customerOffer.findUniqueOrThrow({
          where: { id: offerId },
          include: adminOfferInclude,
        });
        return adminOfferResponse(updatedOffer);
      });
      response.json({ offer: result });
    },
  );

  router.post(
    "/admin/offers/:offerId/publish-results",
    requireAuth,
    requireStaffPermission("content"),
    validateRequest({ params: offerParams }),
    async (_request, response) => {
      const admin = getAuthenticatedUser(response);
      const { offerId } = paramsOf(response);
      const result = await database.$transaction(async (transaction) => {
        const offer = await transaction.customerOffer.findUnique({
          where: { id: offerId },
          include: adminOfferInclude,
        });
        if (!offer) {
          throw new HttpError(
            404,
            "OFFER_NOT_FOUND",
            "Предложение не найдено.",
          );
        }
        if (offer.type !== "GIVEAWAY" || !offer.drawnAt) {
          throw new HttpError(
            409,
            "GIVEAWAY_NOT_DRAWN",
            "Сначала выберите победителей.",
          );
        }
        if (offer.resultsPublishedAt) return adminOfferResponse(offer);
        const rewardPlacesCount = getConfiguredCustomerOfferRewardCount(offer);
        const hasCompleteResults = offer.entries.length === rewardPlacesCount;
        if (!hasCompleteResults) {
          throw new HttpError(
            409,
            "GIVEAWAY_RESULTS_INCOMPLETE",
            "В результатах должны быть все разыгранные места.",
          );
        }

        const resultsPublishedAt = new Date();
        const claimed = await transaction.customerOffer.updateMany({
          where: {
            id: offerId,
            drawnAt: { not: null },
            resultsPublishedAt: null,
          },
          data: { resultsPublishedAt },
        });
        if (claimed.count !== 1) {
          const current = await transaction.customerOffer.findUniqueOrThrow({
            where: { id: offerId },
            include: adminOfferInclude,
          });
          if (current.resultsPublishedAt) return adminOfferResponse(current);
          throw new HttpError(
            409,
            "GIVEAWAY_RESULTS_ALREADY_PUBLISHED",
            "Результаты уже опубликованы.",
          );
        }

        const rewards = offer.entries.flatMap((winner) => {
          if (winner.place === null) return [];
          const reward = getCustomerOfferReward(offer, winner.place);
          if (!reward || reward.bonusPoints <= 0) return [];
          return [
            {
              customerId: winner.customerId,
              customerOfferId: offerId,
              actorId: admin.id,
              type: "OFFER_REWARD" as const,
              points: reward.bonusPoints,
              reason:
                `Награда за ${winner.place}-е место в «${offer.title}»`.slice(
                  0,
                  255,
                ),
            },
          ];
        });
        if (rewards.length > 0) {
          await transaction.loyaltyTransaction.createMany({
            data: rewards,
            skipDuplicates: true,
          });
        }
        await scheduleCustomerOfferWinnerPush(
          transaction,
          offerId,
          offer.entries.map(({ customerId }) => customerId),
        );

        const updatedOffer = await transaction.customerOffer.findUniqueOrThrow({
          where: { id: offerId },
          include: adminOfferInclude,
        });
        return adminOfferResponse(updatedOffer);
      });
      response.json({ offer: result });
    },
  );
};
