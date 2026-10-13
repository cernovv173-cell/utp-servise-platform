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
import { getMoscowWeekStart } from "./game-week.js";

const BONUS_PER_EPISODE = 10;
const WEEKLY_BONUS_LIMIT = 50;

const episodeIdParams = z.object({ episodeId: z.string().uuid() });
const answerBody = z
  .object({
    questionId: z.string().uuid(),
    optionId: z.string().uuid(),
  })
  .strict();
const completionBody = z
  .object({
    answers: z
      .array(
        z
          .object({
            questionId: z.string().uuid(),
            optionId: z.string().uuid(),
          })
          .strict(),
      )
      .min(1)
      .max(20),
  })
  .strict();

const optionInput = z
  .object({
    text: z.string().trim().min(2).max(300),
    isCorrect: z.boolean(),
  })
  .strict();
const questionInput = z
  .object({
    prompt: z.string().trim().min(5).max(500),
    correctFeedback: z.string().trim().min(5).max(500),
    incorrectFeedback: z.string().trim().min(5).max(500),
    options: z.array(optionInput).min(2).max(5),
  })
  .strict()
  .refine(
    (question) =>
      question.options.filter(({ isCorrect }) => isCorrect).length === 1,
    {
      message: "У каждого вопроса должен быть ровно один правильный вариант.",
      path: ["options"],
    },
  );

const episodeFields = {
  title: z.string().trim().min(3).max(120),
  introduction: z.string().trim().min(10).max(1000),
  isActive: z.boolean().optional(),
  questions: z.array(questionInput).min(1).max(20),
};
const createEpisodeBody = z.object(episodeFields).strict();
const updateEpisodeBody = z
  .object({
    title: episodeFields.title.optional(),
    introduction: episodeFields.introduction.optional(),
    isActive: z.boolean().optional(),
    questions: episodeFields.questions.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0);

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const includeQuestions = {
  questions: {
    orderBy: { position: "asc" as const },
    include: { options: { orderBy: { position: "asc" as const } } },
  },
};

const toAdminEpisode = <T extends { questions: Array<{ options: unknown[] }> }>(
  episode: T,
) => episode;

const toPublicEpisode = <
  T extends {
    id: string;
    title: string;
    introduction: string;
    questions: Array<{
      id: string;
      prompt: string;
      correctFeedback: string;
      incorrectFeedback: string;
      options: Array<{ id: string; text: string; isCorrect: boolean }>;
    }>;
  },
>(
  episode: T,
  completed: boolean,
) => ({
  id: episode.id,
  title: episode.title,
  introduction: episode.introduction,
  completed,
  questions: episode.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    correctFeedback: question.correctFeedback,
    incorrectFeedback: question.incorrectFeedback,
    options: question.options.map(({ id, text }) => ({ id, text })),
  })),
});

const nestedQuestionCreate = (
  questions: z.infer<typeof episodeFields.questions>,
) =>
  questions.map((question, questionIndex) => ({
    position: questionIndex,
    prompt: question.prompt,
    correctFeedback: question.correctFeedback,
    incorrectFeedback: question.incorrectFeedback,
    options: {
      create: question.options.map((option, optionIndex) => ({
        text: option.text,
        isCorrect: option.isCorrect,
        position: optionIndex,
      })),
    },
  }));

export const createGamesRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);
  const requireCustomer = [requireAuth, requireRoles("CUSTOMER")];
  const requireAdmin = [requireAuth, requireRoles("ADMIN")];

  router.get(
    "/games/episodes",
    ...requireCustomer,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const [episodes, completions, balance, weeklyBonus] = await Promise.all([
        database.gameEpisode.findMany({
          where: { isActive: true },
          orderBy: { createdAt: "desc" },
          include: includeQuestions,
        }),
        database.gameEpisodeCompletion.findMany({
          where: { customerId: user.id },
          select: { episodeId: true },
        }),
        database.loyaltyTransaction.aggregate({
          where: { customerId: user.id },
          _sum: { points: true },
        }),
        database.loyaltyTransaction.aggregate({
          where: {
            customerId: user.id,
            type: "GAME_REWARD",
            createdAt: { gte: getMoscowWeekStart(new Date()) },
          },
          _sum: { points: true },
        }),
      ]);
      const completedIds = new Set(
        completions.map(({ episodeId }) => episodeId),
      );
      response.json({
        episodes: episodes.map((episode) =>
          toPublicEpisode(episode, completedIds.has(episode.id)),
        ),
        balance: balance._sum.points ?? 0,
        weeklyAwardedPoints: weeklyBonus._sum.points ?? 0,
        weeklyLimit: WEEKLY_BONUS_LIMIT,
        pointsPerEpisode: BONUS_PER_EPISODE,
      });
    },
  );

  router.post(
    "/games/episodes/:episodeId/answer",
    ...requireCustomer,
    validateRequest({ params: episodeIdParams, body: answerBody }),
    async (_request, response) => {
      const { episodeId } = paramsOf<z.infer<typeof episodeIdParams>>(response);
      const { questionId, optionId } =
        bodyOf<z.infer<typeof answerBody>>(response);
      const question = await database.gameQuestion.findFirst({
        where: {
          id: questionId,
          episodeId,
          episode: { isActive: true },
        },
        include: { options: true },
      });
      if (!question) {
        throw new HttpError(
          404,
          "GAME_QUESTION_NOT_FOUND",
          "Вопрос не найден.",
        );
      }
      const selectedOption = question.options.find(({ id }) => id === optionId);
      if (!selectedOption) {
        throw new HttpError(
          400,
          "GAME_OPTION_INVALID",
          "Выберите ответ из списка.",
        );
      }
      response.json({
        correct: selectedOption.isCorrect,
        feedback: selectedOption.isCorrect
          ? question.correctFeedback
          : question.incorrectFeedback,
      });
    },
  );

  router.post(
    "/games/episodes/:episodeId/complete",
    ...requireCustomer,
    validateRequest({ params: episodeIdParams, body: completionBody }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const { episodeId } = paramsOf<z.infer<typeof episodeIdParams>>(response);
      const { answers } = bodyOf<z.infer<typeof completionBody>>(response);
      const episode = await database.gameEpisode.findFirst({
        where: { id: episodeId, isActive: true },
        include: includeQuestions,
      });
      if (!episode) {
        throw new HttpError(
          404,
          "GAME_EPISODE_NOT_FOUND",
          "Этот сценарий уже недоступен.",
        );
      }

      const answerMap = new Map(
        answers.map(({ questionId, optionId }) => [questionId, optionId]),
      );
      const allAnswersCorrect =
        answers.length === episode.questions.length &&
        answerMap.size === episode.questions.length &&
        episode.questions.every((question) =>
          question.options.some(
            (option) =>
              option.id === answerMap.get(question.id) && option.isCorrect,
          ),
        );
      if (!allAnswersCorrect) {
        throw new HttpError(
          422,
          "GAME_EPISODE_INCOMPLETE",
          "Сначала правильно ответьте на все вопросы сценария.",
        );
      }

      const result = await database.$transaction(async (transaction) => {
        await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`utp-game-${user.id}`}))`;
        const existing = await transaction.gameEpisodeCompletion.findUnique({
          where: {
            customerId_episodeId: { customerId: user.id, episodeId },
          },
        });
        const weekStart = getMoscowWeekStart(new Date());
        const weeklyAggregate = await transaction.loyaltyTransaction.aggregate({
          where: {
            customerId: user.id,
            type: "GAME_REWARD",
            createdAt: { gte: weekStart },
          },
          _sum: { points: true },
        });
        const weeklyAwardedPoints = weeklyAggregate._sum.points ?? 0;
        if (existing) {
          const currentBalance = await transaction.loyaltyTransaction.aggregate(
            {
              where: { customerId: user.id },
              _sum: { points: true },
            },
          );
          return {
            awardedPoints: 0,
            balance: currentBalance._sum.points ?? 0,
            weeklyAwardedPoints,
            alreadyCompleted: true,
            weeklyLimitReached: weeklyAwardedPoints >= WEEKLY_BONUS_LIMIT,
          };
        }

        const awardedPoints =
          weeklyAwardedPoints + BONUS_PER_EPISODE <= WEEKLY_BONUS_LIMIT
            ? BONUS_PER_EPISODE
            : 0;
        await transaction.gameEpisodeCompletion.create({
          data: {
            customerId: user.id,
            episodeId,
            pointsAwarded: awardedPoints,
          },
        });
        if (awardedPoints > 0) {
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: user.id,
              type: "GAME_REWARD",
              points: awardedPoints,
              reason: `Игра: ${episode.title}`,
            },
          });
        }
        const currentBalance = await transaction.loyaltyTransaction.aggregate({
          where: { customerId: user.id },
          _sum: { points: true },
        });
        return {
          awardedPoints,
          balance: currentBalance._sum.points ?? 0,
          weeklyAwardedPoints: weeklyAwardedPoints + awardedPoints,
          alreadyCompleted: false,
          weeklyLimitReached: awardedPoints === 0,
        };
      });

      response.json(result);
    },
  );

  router.get(
    "/admin/games/episodes",
    ...requireAdmin,
    async (_request, response) => {
      const episodes = await database.gameEpisode.findMany({
        orderBy: { createdAt: "desc" },
        include: includeQuestions,
      });
      response.json({ episodes: episodes.map(toAdminEpisode) });
    },
  );

  router.post(
    "/admin/games/episodes",
    ...requireAdmin,
    validateRequest({ body: createEpisodeBody }),
    async (_request, response) => {
      const admin = getAuthenticatedUser(response);
      const input = bodyOf<z.infer<typeof createEpisodeBody>>(response);
      const episode = await database.gameEpisode.create({
        data: {
          title: input.title,
          introduction: input.introduction,
          isActive: input.isActive ?? true,
          createdById: admin.id,
          questions: { create: nestedQuestionCreate(input.questions) },
        },
        include: includeQuestions,
      });
      response.status(201).json({ episode });
    },
  );

  router.patch(
    "/admin/games/episodes/:episodeId",
    ...requireAdmin,
    validateRequest({ params: episodeIdParams, body: updateEpisodeBody }),
    async (_request, response) => {
      const { episodeId } = paramsOf<z.infer<typeof episodeIdParams>>(response);
      const input = bodyOf<z.infer<typeof updateEpisodeBody>>(response);
      const { questions, ...fields } = input;
      const episode = await database.$transaction(async (transaction) => {
        if (questions) {
          await transaction.gameQuestion.deleteMany({ where: { episodeId } });
        }
        return transaction.gameEpisode.update({
          where: { id: episodeId },
          data: {
            ...fields,
            ...(questions
              ? { questions: { create: nestedQuestionCreate(questions) } }
              : {}),
          },
          include: includeQuestions,
        });
      });
      response.json({ episode });
    },
  );

  return router;
};
