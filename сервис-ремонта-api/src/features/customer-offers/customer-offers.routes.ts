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
import { selectRandomWinners } from "./winner-selection.js";

const offerParams = z.object({ offerId: z.string().uuid() });
const offerType = z.enum(["PROMOTION", "GIVEAWAY"]);
const dateTime = z.string().datetime({ offset: true });

const createOfferBody = z
  .object({
    type: offerType,
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(1).max(8000),
    prize: z.string().trim().max(500).nullable().optional(),
    bonusPoints: z.number().int().min(0).max(100_000).default(0),
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
    (body) =>
      body.type === "GIVEAWAY"
        ? Boolean(body.prize?.trim()) || body.bonusPoints > 0
        : !body.prize && body.bonusPoints === 0,
    {
      message:
        "Для розыгрыша укажите приз или баллы; у акции не задаются призовые баллы.",
      path: ["prize"],
    },
  );

const updateOfferBody = z
  .object({ isPublished: z.boolean() })
  .strict();

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
    prize: string | null;
    bonusPoints: number;
    isPublished: boolean;
    startsAt: Date;
    endsAt: Date;
    drawnAt: Date | null;
    createdAt: Date;
    _count: { entries: number };
    entries: Array<{ id: string; joinedAt: Date; isWinner: boolean }>;
  },
>(offer: T) => ({
  id: offer.id,
  type: offer.type,
  title: offer.title,
  content: offer.content,
  prize: offer.prize,
  bonusPoints: offer.bonusPoints,
  isPublished: offer.isPublished,
  startsAt: offer.startsAt,
  endsAt: offer.endsAt,
  drawnAt: offer.drawnAt,
  createdAt: offer.createdAt,
  participantCount: offer._count.entries,
  myParticipation: offer.entries[0] ?? null,
});

const adminOfferResponse = <
  T extends {
    id: string;
    type: "PROMOTION" | "GIVEAWAY";
    title: string;
    content: string;
    prize: string | null;
    bonusPoints: number;
    isPublished: boolean;
    startsAt: Date;
    endsAt: Date;
    drawnAt: Date | null;
    createdAt: Date;
    _count: { entries: number };
    entries: Array<{
      customerId: string;
      joinedAt: Date;
      customer: { displayName: string };
    }>;
  },
>(offer: T) => ({
  id: offer.id,
  type: offer.type,
  title: offer.title,
  content: offer.content,
  prize: offer.prize,
  bonusPoints: offer.bonusPoints,
  isPublished: offer.isPublished,
  startsAt: offer.startsAt,
  endsAt: offer.endsAt,
  drawnAt: offer.drawnAt,
  createdAt: offer.createdAt,
  participantCount: offer._count.entries,
  winners: offer.entries.map((entry) => ({
    customerId: entry.customerId,
    displayName: entry.customer.displayName,
    joinedAt: entry.joinedAt,
  })),
});

const adminOfferInclude = {
  _count: { select: { entries: true } },
  entries: {
    where: { isWinner: true },
    orderBy: { joinedAt: "asc" as const },
    select: {
      customerId: true,
      joinedAt: true,
      customer: { select: { displayName: true } },
    },
  },
};

export const createCustomerOffersRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

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
            where: { customerId: user.id },
            select: { id: true, joinedAt: true, isWinner: true },
            take: 1,
          },
        },
      });
      response.json({ offers: offers.map(customerOfferResponse) });
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
        throw new HttpError(404, "OFFER_NOT_FOUND", "Акция или розыгрыш не найдены.");
      }

      const key = { offerId_customerId: { offerId, customerId: user.id } };
      const existing = await database.customerOfferParticipation.findUnique({
        where: key,
        select: { id: true, joinedAt: true, isWinner: true },
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
          select: { id: true, joinedAt: true, isWinner: true },
        });
        response.status(201).json({
          participation,
          alreadyParticipating: false,
        });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const participation = await database.customerOfferParticipation.findUnique({
          where: key,
          select: { id: true, joinedAt: true, isWinner: true },
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
      const offer = await database.customerOffer.create({
        data: {
          type: input.type,
          title: input.title,
          content: input.content,
          prize: input.type === "GIVEAWAY" ? input.prize?.trim() || null : null,
          bonusPoints: input.type === "GIVEAWAY" ? input.bonusPoints : 0,
          startsAt: new Date(input.startsAt),
          endsAt: new Date(input.endsAt),
          isPublished: input.isPublished,
          createdById: user.id,
        },
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
      const current = await database.customerOffer.findUnique({
        where: { id: offerId },
        select: { id: true },
      });
      if (!current) {
        throw new HttpError(404, "OFFER_NOT_FOUND", "Акция или розыгрыш не найдены.");
      }
      const offer = await database.customerOffer.update({
        where: { id: offerId },
        data: { isPublished: input.isPublished },
      });
      response.json({ offer });
    },
  );

  router.post(
    "/admin/offers/:offerId/draw",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: offerParams }),
    async (_request, response) => {
      const admin = getAuthenticatedUser(response);
      const { offerId } = paramsOf(response);
      const result = await database.$transaction(async (transaction) => {
        const offer = await transaction.customerOffer.findUnique({
          where: { id: offerId },
        });
        if (!offer) {
          throw new HttpError(404, "OFFER_NOT_FOUND", "Розыгрыш не найден.");
        }
        if (offer.type !== "GIVEAWAY") {
          throw new HttpError(409, "NOT_A_GIVEAWAY", "Победителя можно выбрать только в розыгрыше.");
        }
        if (offer.drawnAt) {
          throw new HttpError(409, "GIVEAWAY_ALREADY_DRAWN", "Победитель уже выбран.");
        }
        const drawnAt = new Date();
        if (offer.endsAt > drawnAt) {
          throw new HttpError(
            409,
            "GIVEAWAY_NOT_ENDED",
            "Выбрать победителя можно после окончания приёма участников.",
          );
        }
        const entries = await transaction.customerOfferParticipation.findMany({
          where: { offerId },
          select: { id: true, customerId: true },
        });
        if (entries.length === 0) {
          throw new HttpError(409, "GIVEAWAY_HAS_NO_ENTRIES", "В розыгрыше пока нет участников.");
        }

        const [winner] = selectRandomWinners(entries, 1);
        if (!winner) {
          throw new HttpError(409, "GIVEAWAY_HAS_NO_ENTRIES", "В розыгрыше пока нет участников.");
        }
        const claimed = await transaction.customerOffer.updateMany({
          where: { id: offerId, drawnAt: null },
          data: { drawnAt },
        });
        if (claimed.count !== 1) {
          throw new HttpError(409, "GIVEAWAY_ALREADY_DRAWN", "Победитель уже выбран.");
        }
        await transaction.customerOfferParticipation.updateMany({
          where: { id: winner.id, offerId },
          data: { isWinner: true },
        });
        if (offer.bonusPoints > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: winner.customerId,
              customerOfferId: offerId,
              actorId: admin.id,
              type: "OFFER_REWARD",
              points: offer.bonusPoints,
              reason: `Награда за розыгрыш «${offer.title}»${offer.prize ? `: ${offer.prize}` : ""}`.slice(0, 255),
            },
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

  return router;
};
