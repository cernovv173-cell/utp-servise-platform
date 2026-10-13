import express from "express";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createGamesRouter } from "../src/features/games/games.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const CUSTOMER_TOKEN = "C".repeat(48);
const ADMIN_TOKEN = "A".repeat(48);
const CUSTOMER_ID = "11111111-1111-4111-8111-111111111111";
const ADMIN_ID = "22222222-2222-4222-8222-222222222222";
const EPISODE_ID = "d4b60b1a-61ae-4c6e-a223-7ded6e2c2001";
const QUESTIONS = [
  {
    id: "d4b60b1a-61ae-4c6e-a223-7ded6e2c2101",
    prompt: "Уточните время появления проблемы",
    correctFeedback: "Верно, сначала уточняем симптомы.",
    incorrectFeedback: "Неверно, не запрашивайте секретные данные.",
    options: [
      {
        id: "d4b60b1a-61ae-4c6e-a223-7ded6e2c2201",
        text: "Когда возникает шум?",
        isCorrect: true,
        position: 0,
      },
      {
        id: "d4b60b1a-61ae-4c6e-a223-7ded6e2c2202",
        text: "Какой пароль?",
        isCorrect: false,
        position: 1,
      },
    ],
    position: 0,
  },
];

type FixtureEpisode = {
  id: string;
  title: string;
  introduction: string;
  isActive: boolean;
  questions: typeof QUESTIONS;
};

const startServer = async (
  t: { after: (callback: () => Promise<void>) => void },
  options: { weeklyPoints?: number; episodes?: FixtureEpisode[] } = {},
) => {
  const now = new Date();
  const episodes = options.episodes ?? [
    {
      id: EPISODE_ID,
      title: "Шумный компьютер",
      introduction: "Компьютер шумит и выключается во время игры.",
      isActive: true,
      questions: QUESTIONS,
    },
  ];
  const completions: Array<Record<string, unknown>> = [];
  const transactions: Array<Record<string, unknown>> = Array.from(
    { length: (options.weeklyPoints ?? 0) / 10 },
    (_, index) => ({
      id: `prior-${index}`,
      customerId: CUSTOMER_ID,
      type: "GAME_REWARD",
      points: 10,
      createdAt: now,
      reason: "Предыдущая игровая награда",
    }),
  );
  const tokens = new Map([
    [
      hashSessionToken(CUSTOMER_TOKEN),
      {
        id: CUSTOMER_ID,
        email: "client@example.test",
        displayName: "Клиент",
        phoneNumber: null,
        gender: null,
        birthDate: null,
        telegramChatId: null,
        maxUserId: null,
        avatarObjectId: null,
        role: "CUSTOMER" as const,
        active: true,
        mustChangePassword: false,
      },
    ],
    [
      hashSessionToken(ADMIN_TOKEN),
      {
        id: ADMIN_ID,
        email: "admin@example.test",
        displayName: "Администратор",
        phoneNumber: null,
        gender: null,
        birthDate: null,
        telegramChatId: null,
        maxUserId: null,
        avatarObjectId: null,
        role: "ADMIN" as const,
        active: true,
        mustChangePassword: false,
      },
    ],
  ]);
  const findEpisode = (id: string) =>
    episodes.find((episode) => episode.id === id);
  const withQuestions = (episode: FixtureEpisode) => ({ ...episode });
  const client = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        const user = tokens.get(where.tokenHash);
        return user ? { user, expiresAt: new Date(Date.now() + 60_000) } : null;
      },
    },
    gameEpisode: {
      findMany: async ({ where }: { where: { isActive?: boolean } }) =>
        episodes
          .filter((episode) => where.isActive === undefined || episode.isActive)
          .map(withQuestions),
      findFirst: async ({
        where,
      }: {
        where: { id: string; isActive?: boolean };
      }) => {
        const episode = findEpisode(where.id);
        return episode && (where.isActive === undefined || episode.isActive)
          ? withQuestions(episode)
          : null;
      },
      create: async ({ data }: { data: Record<string, any> }) => {
        const questions = data.questions.create.map(
          (question: Record<string, any>) => ({
            id: randomUUID(),
            ...question,
            options: question.options.create.map(
              (option: Record<string, any>) => ({
                id: randomUUID(),
                ...option,
              }),
            ),
          }),
        );
        const episode = {
          id: randomUUID(),
          title: data.title,
          introduction: data.introduction,
          isActive: data.isActive,
          questions,
        } as FixtureEpisode;
        episodes.unshift(episode);
        return withQuestions(episode);
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Record<string, any>;
      }) => {
        const episode = findEpisode(where.id);
        if (!episode) throw new Error("Record not found");
        if (data.title !== undefined) episode.title = data.title;
        if (data.introduction !== undefined)
          episode.introduction = data.introduction;
        if (data.isActive !== undefined) episode.isActive = data.isActive;
        if (data.questions) {
          episode.questions = data.questions.create.map(
            (question: Record<string, any>, index: number) => ({
              id: `updated-${index}`,
              ...question,
              options: question.options.create.map(
                (option: Record<string, any>) => ({
                  id: randomUUID(),
                  ...option,
                }),
              ),
            }),
          ) as typeof QUESTIONS;
        }
        return withQuestions(episode);
      },
    },
    gameQuestion: {
      findFirst: async ({
        where,
      }: {
        where: {
          id: string;
          episodeId: string;
          episode: { isActive: boolean };
        };
      }) => {
        const episode = findEpisode(where.episodeId);
        return episode?.isActive
          ? (episode.questions.find((question) => question.id === where.id) ??
              null)
          : null;
      },
      deleteMany: async ({ where }: { where: { episodeId: string } }) => {
        const episode = findEpisode(where.episodeId);
        if (episode) episode.questions = [] as unknown as typeof QUESTIONS;
        return { count: 0 };
      },
    },
    gameEpisodeCompletion: {
      findMany: async ({ where }: { where: { customerId: string } }) =>
        completions.filter(
          (completion) => completion.customerId === where.customerId,
        ),
      findUnique: async ({
        where,
      }: {
        where: {
          customerId_episodeId: { customerId: string; episodeId: string };
        };
      }) =>
        completions.find(
          (completion) =>
            completion.customerId === where.customerId_episodeId.customerId &&
            completion.episodeId === where.customerId_episodeId.episodeId,
        ) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const completion = {
          id: randomUUID(),
          completedAt: new Date(),
          ...data,
        };
        completions.push(completion);
        return completion;
      },
    },
    loyaltyTransaction: {
      aggregate: async ({
        where,
      }: {
        where: { customerId: string; type?: string; createdAt?: { gte: Date } };
      }) => {
        const points = transactions
          .filter((transaction) => transaction.customerId === where.customerId)
          .filter(
            (transaction) =>
              where.type === undefined || transaction.type === where.type,
          )
          .filter(
            (transaction) =>
              !where.createdAt ||
              (transaction.createdAt as Date) >= where.createdAt.gte,
          )
          .reduce((sum, transaction) => sum + Number(transaction.points), 0);
        return { _sum: { points } };
      },
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const transaction = {
          id: randomUUID(),
          createdAt: new Date(),
          ...data,
        };
        transactions.push(transaction);
        return transaction;
      },
    },
    $transaction: async (
      callback: (transaction: typeof client) => Promise<unknown>,
    ) => callback(client),
    $executeRaw: async () => 0,
  };

  const app = express();
  app.use(express.json());
  app.use("/api", createGamesRouter(client as unknown as DatabaseClient));
  app.use(errorHandler);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert(address && typeof address !== "string");
  t.after(async () => {
    server.close();
    await once(server, "close");
  });
  return {
    url: `http://127.0.0.1:${address.port}/api`,
    episodes,
    completions,
    transactions,
  };
};

test("game answers are checked privately and a full first completion awards once", async (t) => {
  const server = await startServer(t);
  const listResponse = await fetch(`${server.url}/games/episodes`, {
    headers: { Authorization: `Bearer ${CUSTOMER_TOKEN}` },
  });
  assert.equal(listResponse.status, 200);
  const list = (await listResponse.json()) as {
    episodes: Array<{
      questions: Array<{ options: Array<Record<string, unknown>> }>;
    }>;
  };
  assert.equal(
    "isCorrect" in list.episodes[0]!.questions[0]!.options[0]!,
    false,
  );

  const question = QUESTIONS[0]!;
  const wrongResponse = await fetch(
    `${server.url}/games/episodes/${EPISODE_ID}/answer`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CUSTOMER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        questionId: question.id,
        optionId: question.options[1]!.id,
      }),
    },
  );
  assert.equal(wrongResponse.status, 200);
  assert.equal(
    ((await wrongResponse.json()) as { correct: boolean }).correct,
    false,
  );
  assert.equal(server.transactions.length, 0);

  const answers = question.options
    .filter(({ isCorrect }) => isCorrect)
    .map(({ id }) => ({ questionId: question.id, optionId: id }));
  const complete = () =>
    fetch(`${server.url}/games/episodes/${EPISODE_ID}/complete`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CUSTOMER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ answers }),
    });
  const firstReward = await complete();
  assert.equal(firstReward.status, 200);
  assert.deepEqual(await firstReward.json(), {
    awardedPoints: 10,
    balance: 10,
    weeklyAwardedPoints: 10,
    alreadyCompleted: false,
    weeklyLimitReached: false,
  });
  const repeat = await complete();
  assert.equal(repeat.status, 200);
  assert.deepEqual(await repeat.json(), {
    awardedPoints: 0,
    balance: 10,
    weeklyAwardedPoints: 10,
    alreadyCompleted: true,
    weeklyLimitReached: false,
  });
  assert.equal(server.transactions.length, 1);
});

test("only administrators can add episodes and weekly rewards never exceed 50 points", async (t) => {
  const existingEpisodes = Array.from({ length: 5 }, (_, index) => ({
    id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`,
    title: `Сценарий ${index + 1}`,
    introduction: "Проверьте ситуацию с компьютерной техникой.",
    isActive: true,
    questions: QUESTIONS.map((question, questionIndex) => ({
      ...question,
      id: randomUUID(),
      position: questionIndex,
      options: question.options.map((option) => ({
        ...option,
        id: randomUUID(),
      })),
    })),
  }));
  const server = await startServer(t, {
    weeklyPoints: 40,
    episodes: existingEpisodes,
  });
  const customerCreate = await fetch(`${server.url}/admin/games/episodes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CUSTOMER_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Новое задание",
      introduction: "Сценарий про компьютер.",
      isActive: true,
      questions: QUESTIONS,
    }),
  });
  assert.equal(customerCreate.status, 403);

  const adminCreate = await fetch(`${server.url}/admin/games/episodes`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: "Новое задание",
      introduction: "Сценарий про компьютер.",
      isActive: true,
      questions: [
        {
          prompt: "Какой ответ безопасен?",
          correctFeedback: "Верно, безопасная диагностика важна.",
          incorrectFeedback: "Не совсем, попробуйте безопасный вариант.",
          options: [
            { text: "Обратиться к специалисту", isCorrect: true },
            { text: "Вскрыть блок питания", isCorrect: false },
          ],
        },
      ],
    }),
  });
  assert.equal(adminCreate.status, 201);
  const createdEpisode = (
    (await adminCreate.json()) as {
      episode: {
        id: string;
        questions: Array<{
          id: string;
          options: Array<{ id: string; isCorrect: boolean }>;
        }>;
      };
    }
  ).episode;
  const question = createdEpisode.questions[0]!;
  const correctOption = question.options.find(({ isCorrect }) => isCorrect)!;
  const completion = await fetch(
    `${server.url}/games/episodes/${createdEpisode.id}/complete`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CUSTOMER_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        answers: [{ questionId: question.id, optionId: correctOption.id }],
      }),
    },
  );
  assert.equal(completion.status, 200);
  assert.deepEqual(await completion.json(), {
    awardedPoints: 10,
    balance: 50,
    weeklyAwardedPoints: 50,
    alreadyCompleted: false,
    weeklyLimitReached: false,
  });
  assert.equal(
    server.transactions
      .filter(({ type }) => type === "GAME_REWARD")
      .reduce((sum, row) => sum + Number(row.points), 0),
    50,
  );
});
