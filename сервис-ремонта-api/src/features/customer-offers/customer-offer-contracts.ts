import { z } from "zod";

import { getCustomerOfferReward } from "./customer-offer-rewards.js";

export const offerParams = z.object({ offerId: z.string().uuid() });
export const offerType = z.enum(["PROMOTION", "GIVEAWAY"]);
const dateTime = z.string().datetime({ offset: true });
const optionalPrize = z.string().trim().max(500).nullable().optional();
const points = z.number().int().min(0).max(100_000).default(0);
export const participationBody = z.object({}).strict().default({});

export const createOfferBody = z
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
        ? (() => {
            const configured = rewards.map(
              ([prize, prizePoints]) =>
                Boolean(prize?.trim()) || prizePoints > 0,
            );
            return (
              configured.some(Boolean) &&
              configured[0] === true &&
              !(configured[2] && !configured[1])
            );
          })()
        : rewards.every(([prize, prizePoints]) => !prize && prizePoints === 0);
    },
    {
      message:
        "Укажите награду хотя бы для 1-го места; места заполняются по порядку. Для акции награды не задаются.",
      path: ["firstPlacePrize"],
    },
  );

export const updateOfferBody = z.object({ isPublished: z.boolean() }).strict();

export const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;

export const paramsOf = (response: { locals: { input?: unknown } }) =>
  (response.locals.input as { readonly params: z.infer<typeof offerParams> })
    .params;

export const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const customerOfferResponse = <
  T extends {
    id: string;
    type: string;
    title: string;
    content: string;
    firstPlacePrize: string | null;
    firstPlacePrizeImageId: string | null;
    firstPlacePoints: number;
    secondPlacePrize: string | null;
    secondPlacePrizeImageId: string | null;
    secondPlacePoints: number;
    thirdPlacePrize: string | null;
    thirdPlacePrizeImageId: string | null;
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
    firstPlacePrizeImageId: offer.firstPlacePrizeImageId,
    firstPlacePoints: offer.firstPlacePoints,
    secondPlacePrize: offer.secondPlacePrize,
    secondPlacePrizeImageId: offer.secondPlacePrizeImageId,
    secondPlacePoints: offer.secondPlacePoints,
    thirdPlacePrize: offer.thirdPlacePrize,
    thirdPlacePrizeImageId: offer.thirdPlacePrizeImageId,
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

export const adminOfferResponse = <
  T extends {
    id: string;
    type: string;
    title: string;
    content: string;
    firstPlacePrize: string | null;
    firstPlacePrizeImageId: string | null;
    firstPlacePoints: number;
    secondPlacePrize: string | null;
    secondPlacePrizeImageId: string | null;
    secondPlacePoints: number;
    thirdPlacePrize: string | null;
    thirdPlacePrizeImageId: string | null;
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
  firstPlacePrizeImageId: offer.firstPlacePrizeImageId,
  firstPlacePoints: offer.firstPlacePoints,
  secondPlacePrize: offer.secondPlacePrize,
  secondPlacePrizeImageId: offer.secondPlacePrizeImageId,
  secondPlacePoints: offer.secondPlacePoints,
  thirdPlacePrize: offer.thirdPlacePrize,
  thirdPlacePrizeImageId: offer.thirdPlacePrizeImageId,
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

export const adminOfferInclude = {
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
