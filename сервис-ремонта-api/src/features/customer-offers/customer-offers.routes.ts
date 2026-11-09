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
import { scheduleCustomerOfferPush } from "./customer-offer-push-delivery.js";
import { getCustomerOfferReward } from "./customer-offer-rewards.js";
import { scheduleCustomerOfferWinnerPush } from "./customer-offer-winner-push-delivery.js";
import { selectRandomWinners } from "./winner-selection.js";

const offerParams = z.object({ offerId: z.string().uuid() });
const offerType = z.enum(["PROMOTION", "GIVEAWAY"]);
const dateTime = z.string().datetime({ offset: true });
const optionalPrize = z.string().trim().max(500).nullable().optional();
const points = z.number().int().min(0).max(100_000).default(0);

const createOfferBody = z
  .object({
    type: offerType,
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(1).max(8000),
    firstPlacePrize: optionalPrize,
    firstPlacePoints: points,
    secondPlacePrize: optionalPrize,
    secondPlacePoints: points,
    thirdPlacePrize: optionalPrize,
    thirdPlacePoints: points,
    startsAt: dateTime,
    endsAt: dateTime,
    isPublished: z.boolean().default(false),
  })
  .strict()
  .refine((body) => new Date(body.endsAt) > new Date(body.startsAt), {
    message: "Дата окончания должна быть позже даты начала.",
    path: ["endsAt"],
  })
  .refine(
    (body) => {
      const rewards: Array<[string | null | undefined, number]> = [
        [body.firstPlacePrize, body.firstPlacePoints],
        [body.secondPlacePrize, body.secondPlacePoints],
        [body.thirdPlacePrize, body.thirdPlacePoints],
      ];
      return body.type === "GIVEAWAY"
        ? rewards.every(
            ([prize, prizePoints]) => Boolean(prize?.trim()) || prizePoints > 0,
          )
        : rewards.every(([prize, prizePoints]) => !prize && prizePoints === 0);
    },
    {
      message:
        "Для каждого места розыгрыша укажите приз или баллы; для акции призовые баллы не задаются.",
      path: ["firstPlacePrize"],
    },
  );

const updateOfferBody = z.object({ isPublished: z.boolean() }).strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;

const paramsOf = (response: { locals: { input?: unknown } }) =>
  (response.locals.input as { readonly params: z.infer<typeof offerParams> })
    .params;

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const customerOfferResponse = <
  T extends {
    id: string;
    type: "PROMOTION" | "GIVEAWAY";
    title: string;
    content: string;
    firstPlacePrize: string | null;
    firstPlacePoints: number;
    secondPlacePrize: string | null;
    secondPlacePoints: number;
    thirdPlacePrize: string | null;
    thirdPlacePoints: number;
    isPublished: boolean;
    startsAt: Date;
    endsAt: Date;
    drawnAt: Date | null;
    resultsPublishedAt: Date | null;
    createdAt: Date;
    _count: { entries: number };
    entries: Array<{
      id: string;
      customerId: string;
      joinedAt: Date;
      place: number | null;
      customer: { displayName: string };
    }>;
  },
>(
  offer: T,
  customerId: string,
) => {
  const myEntry = offer.entries.find(
    (entry) => entry.customerId === customerId,
  );
  const winners = offer.resultsPublishedAt
    ? offer.entries
        .filter((entry) => entry.place !== null)
        .sort((left, right) => (left.place ?? 4) - (right.place ?? 4))
        .map((entry) => ({
          place: entry.place,
          displayName: entry.customer.displayName,
          ...getCustomerOfferReward(offer, entry.place ?? 0),
        }))
    : [];

  return {
    id: offer.id,
    type: offer.type,
    title: offer.title,
    content: offer.content,
    firstPlacePrize: offer.firstPlacePrize,
    firstPlacePoints: offer.firstPlacePoints,
    secondPlacePrize: offer.secondPlacePrize,
    secondPlacePoints: offer.secondPlacePoints,
    thirdPlacePrize: offer.thirdPlacePrize,
    thirdPlacePoints: offer.thirdPlacePoints,
    isPublished: offer.isPublished,
    startsAt: offer.startsAt,
    endsAt: offer.endsAt,
    drawnAt: offer.drawnAt,
    resultsPublishedAt: offer.resultsPublishedAt,
    createdAt: offer.createdAt,
    participantCount: offer._count.entries,
    myParticipation: myEntry
      ? {
          id: myEntry.id,
          joinedAt: myEntry.joinedAt,
          place: offer.resultsPublishedAt ? myEntry.place : null,
        }
      : null,
    winners,
  };
};

const adminOfferResponse = <
  T extends {
    id: string;
    type: "PROMOTION" | "GIVEAWAY";
    title: string;
    content: string;
    firstPlacePrize: string | null;
    firstPlacePoints: number;
    secondPlacePrize: string | null;
    secondPlacePoints: number;
    thirdPlacePrize: string | null;
    thirdPlacePoints: number;
    isPublished: boolean;
    startsAt: Date;
    endsAt: Date;
    drawnAt: Date | null;
    resultsPublishedAt: Date | null;
    createdAt: Date;
    _count: { entries: number };
    entries: Array<{
      customerId: string;
      joinedAt: Date;
      place: number | null;
      customer: { displayName: string };
    }>;
  },
>(
  offer: T,
) => ({
  id: offer.id,
  type: offer.type,
  title: offer.title,
  content: offer.content,
  firstPlacePrize: offer.firstPlacePrize,
  firstPlacePoints: offer.firstPlacePoints,
  secondPlacePrize: offer.secondPlacePrize,
  secondPlacePoints: offer.secondPlacePoints,
  thirdPlacePrize: offer.thirdPlacePrize,
  thirdPlacePoints: offer.thirdPlacePoints,
  isPublished: offer.isPublished,
  startsAt: offer.startsAt,
  endsAt: offer.endsAt,
  drawnAt: offer.drawnAt,
  resultsPublishedAt: offer.resultsPublishedAt,
  createdAt: offer.createdAt,
  participantCount: offer._count.entries,
  winners: offer.entries
    .filter((entry) => entry.place !== null)
    .sort((left, right) => (left.place ?? 4) - (right.place ?? 4))
    .map((entry) => ({
      place: entry.place,
      customerId: entry.customerId,
      displayName: entry.customer.displayName,
      ...getCustomerOfferReward(offer, entry.place ?? 0),
    })),
});

const adminOfferInclude = {
  _count: { select: { entries: true } },
  entries: {
    where: { place: { not: null } },
    orderBy: { place: "asc" as const },
    select: {
      customerId: true,
      joinedAt: true,
      place: true,
      customer: { select: { displayName: true } },
    },
  },
};

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
    validateRequest({ params: offerParams }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { offerId } = paramsOf(response);
      const offer = await database.customerOffer.findUnique({
        where: { id: offerId },
        select: {
          id: true,
          isPublished: true,
          startsAt: true,
          endsAt: true,
        },
      });
      if (!offer) {
        throw new HttpError(
          404,
          "OFFER_NOT_FOUND",
          "Акция или розыгрыш не найдены.",
        );
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
          data: { offerId, customerId: user.id },
          select: { id: true, joinedAt: true, place: true },
        });
        response.status(201).json({
          participation,
          alreadyParticipating: false,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const participation =
          await database.customerOfferParticipation.findUnique({
            where: key,
            select: { id: true, joinedAt: true, place: true },
          });
        if (!participation) throw error;
        response.json({ participation, alreadyParticipating: true });
      }
    },
  );

  router.get(
    "/admin/offers",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const offers = await database.customerOffer.findMany({
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
    requireRoles("ADMIN"),
    validateRequest({ body: createOfferBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createOfferBody>>(response);
      const offer = await database.$transaction(async (transaction) => {
        const created = await transaction.customerOffer.create({
          data: {
            type: input.type,
            title: input.title,
            content: input.content,
            firstPlacePrize:
              input.type === "GIVEAWAY"
                ? input.firstPlacePrize?.trim() || null
                : null,
            firstPlacePoints:
              input.type === "GIVEAWAY" ? input.firstPlacePoints : 0,
            secondPlacePrize:
              input.type === "GIVEAWAY"
                ? input.secondPlacePrize?.trim() || null
                : null,
            secondPlacePoints:
              input.type === "GIVEAWAY" ? input.secondPlacePoints : 0,
            thirdPlacePrize:
              input.type === "GIVEAWAY"
                ? input.thirdPlacePrize?.trim() || null
                : null,
            thirdPlacePoints:
              input.type === "GIVEAWAY" ? input.thirdPlacePoints : 0,
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
    requireRoles("ADMIN"),
    validateRequest({ params: offerParams, body: updateOfferBody }),
    async (_request, response) => {
      const { offerId } = paramsOf(response);
      const input = bodyOf<z.infer<typeof updateOfferBody>>(response);
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
    requireRoles("ADMIN"),
    validateRequest({ params: offerParams }),
    async (_request, response) => {
      const { offerId } = paramsOf(response);
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
      response.status(204).end();
    },
  );

  router.post(
    "/admin/offers/:offerId/draw",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: offerParams }),
    async (_request, response) => {
      const { offerId } = paramsOf(response);
      const result = await database.$transaction(async (transaction) => {
        const offer = await transaction.customerOffer.findUnique({
          where: { id: offerId },
        });
        if (!offer) {
          throw new HttpError(404, "OFFER_NOT_FOUND", "Розыгрыш не найден.");
        }
        if (offer.type !== "GIVEAWAY") {
          throw new HttpError(
            409,
            "NOT_A_GIVEAWAY",
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
        if (entries.length < 3) {
          throw new HttpError(
            409,
            "GIVEAWAY_NEEDS_THREE_ENTRIES",
            "Для розыгрыша трёх мест нужно не менее трёх участников.",
          );
        }

        const winners = selectRandomWinners(entries, 3);
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
    requireRoles("ADMIN"),
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
          throw new HttpError(404, "OFFER_NOT_FOUND", "Розыгрыш не найден.");
        }
        if (offer.type !== "GIVEAWAY" || !offer.drawnAt) {
          throw new HttpError(
            409,
            "GIVEAWAY_NOT_DRAWN",
            "Сначала выберите победителей розыгрыша.",
          );
        }
        if (offer.resultsPublishedAt) return adminOfferResponse(offer);
        if (offer.entries.length !== 3) {
          throw new HttpError(
            409,
            "GIVEAWAY_RESULTS_INCOMPLETE",
            "В результатах должны быть все три места.",
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
                `Награда за ${winner.place}-е место в розыгрыше «${offer.title}»`.slice(
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

  return router;
};
