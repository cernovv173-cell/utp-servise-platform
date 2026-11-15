import { z } from "zod";

import { getCustomerOfferReward } from "./customer-offer-rewards.js";

export const offerParams = z.object({ offerId: z.string().uuid() });
export const offerType = z.enum(["PROMOTION", "GIVEAWAY", "QUIZ"]);
const dateTime = z.string().datetime({ offset: true });
const optionalPrize = z.string().trim().max(500).nullable().optional();
const points = z.number().int().min(0).max(100_000).default(0);
const quizOptions = z
  .array(z.string().trim().min(1).max(120))
  .max(6)
  .default([]);

export const participationBody = z
  .object({ answerIndex: z.number().int().min(0).max(5).optional() })
  .strict()
  .default({});

export const createOfferBody = z
  .object({
    type: offerType,
    title: z.string().trim().min(2).max(160),
    content: z.string().trim().min(1).max(8000),
    quizQuestion: z.string().trim().min(3).max(1000).nullable().optional(),
    quizOptions,
    quizCorrectOption: z.number().int().min(0).max(5).nullable().optional(),
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
      return body.type === "GIVEAWAY" || body.type === "QUIZ"
        ? rewards.every(
            ([prize, prizePoints]) => Boolean(prize?.trim()) || prizePoints > 0,
          )
        : rewards.every(([prize, prizePoints]) => !prize && prizePoints === 0);
    },
    {
      message:
        "Для каждого места розыгрыша или квиза укажите приз или баллы; для акции призовые баллы не задаются.",
      path: ["firstPlacePrize"],
    },
  )
  .superRefine((body, context) => {
    if (body.type === "QUIZ") {
      if (!body.quizQuestion?.trim()) {
        context.addIssue({
          code: "custom",
          message: "Для квиза укажите вопрос.",
          path: ["quizQuestion"],
        });
      }
      if (body.quizOptions.length < 2) {
        context.addIssue({
          code: "custom",
          message: "Добавьте не менее двух вариантов ответа.",
          path: ["quizOptions"],
        });
      }
      if (
        new Set(body.quizOptions.map((option) => option.toLocaleLowerCase()))
          .size !== body.quizOptions.length
      ) {
        context.addIssue({
          code: "custom",
          message: "Варианты ответа должны отличаться.",
          path: ["quizOptions"],
        });
      }
      if (
        body.quizCorrectOption === null ||
        body.quizCorrectOption === undefined ||
        body.quizCorrectOption >= body.quizOptions.length
      ) {
        context.addIssue({
          code: "custom",
          message: "Отметьте правильный вариант ответа.",
          path: ["quizCorrectOption"],
        });
      }
      return;
    }

    if (
      body.quizQuestion?.trim() ||
      body.quizOptions.length > 0 ||
      (body.quizCorrectOption !== null && body.quizCorrectOption !== undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Вопрос и варианты ответа доступны только для квиза.",
        path: ["quizQuestion"],
      });
    }
  });

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
    type: "PROMOTION" | "GIVEAWAY" | "QUIZ";
    title: string;
    content: string;
    quizQuestion: string | null;
    quizOptions: string[];
    quizCorrectOption: number | null;
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
      answerIndex: number | null;
      answerCorrect: boolean | null;
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
    quizQuestion: offer.type === "QUIZ" ? offer.quizQuestion : null,
    quizOptions: offer.type === "QUIZ" ? offer.quizOptions : [],
    quizCorrectOption:
      offer.type === "QUIZ" && offer.resultsPublishedAt
        ? offer.quizCorrectOption
        : null,
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
          answerIndex: myEntry.answerIndex,
          answerCorrect: offer.resultsPublishedAt
            ? myEntry.answerCorrect
            : null,
        }
      : null,
    winners,
  };
};

export const adminOfferResponse = <
  T extends {
    id: string;
    type: "PROMOTION" | "GIVEAWAY" | "QUIZ";
    title: string;
    content: string;
    quizQuestion: string | null;
    quizOptions: string[];
    quizCorrectOption: number | null;
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
  quizQuestion: offer.quizQuestion,
  quizOptions: offer.quizOptions,
  quizCorrectOption: offer.quizCorrectOption,
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
