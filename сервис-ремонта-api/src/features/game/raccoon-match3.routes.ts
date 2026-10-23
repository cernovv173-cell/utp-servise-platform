import { Router } from "express";
import { z } from "zod";

import { Prisma } from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import {
  MATCH3_LEVEL_COUNT,
  MATCH3_POINTS_PER_LEVEL,
  MATCH3_TOTAL_POINTS,
} from "./match3/match3-content.js";
import { recordMatch3LevelReward } from "./match3/match3-rewards.js";
import {
  type RaccoonGameState,
  type RaccoonSessionStatus,
  applyRaccoonBooster,
  applyRaccoonMagnet,
  applyRaccoonMove,
  createRaccoonGameState,
  getRaccoonHint,
  isRaccoonGameState,
  raccoonSnapshot,
} from "./raccoon-game-state.js";

const positionSchema = z.object({
  row: z.number().int().min(0).max(6),
  column: z.number().int().min(0).max(6),
});
const startSchema = z.object({
  level: z.number().int().min(1).max(100).optional(),
});
const sessionSchema = z.object({ sessionId: z.string().uuid() });
const moveSchema = sessionSchema.extend({
  from: positionSchema,
  to: positionSchema,
});
const boosterSchema = sessionSchema.extend({
  booster: z.enum(["hammer", "rocket", "bomb"]),
  target: positionSchema,
});
const sessionIdOnlySchema = sessionSchema;

const uniqueConflict = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const nextLevelNumber = (completed: ReadonlySet<number>): number | null => {
  for (let number = 1; number <= MATCH3_LEVEL_COUNT; number += 1) {
    if (!completed.has(number)) return number;
  }
  return null;
};

type SessionWithLevel = Prisma.RaccoonMatch3SessionGetPayload<{
  include: { level: { select: { number: true } } };
}>;

const serializeSession = (session: SessionWithLevel) => {
  if (
    session.status !== "ACTIVE" &&
    session.status !== "COMPLETE" &&
    session.status !== "FAILED"
  ) {
    throw new HttpError(
      500,
      "GAME_SESSION_INVALID",
      "Состояние игровой сессии повреждено.",
    );
  }
  if (!isRaccoonGameState(session.state, session.level.number)) {
    throw new HttpError(
      500,
      "GAME_SESSION_INVALID",
      "Состояние игровой сессии повреждено.",
    );
  }
  return raccoonSnapshot(
    session.id,
    session.level.number,
    session.status as RaccoonSessionStatus,
    session.state,
  );
};

const findLatestSession = (database: DatabaseClient, customerId: string) =>
  database.raccoonMatch3Session.findFirst({
    where: { customerId, status: { in: ["ACTIVE", "FAILED", "COMPLETE"] } },
    include: { level: { select: { number: true } } },
    orderBy: { createdAt: "desc" },
  });

export const createRaccoonMatch3Router = (database: DatabaseClient): Router => {
  const router = Router();
  const customerOnly = [createRequireAuth(database), requireRoles("CUSTOMER")];

  router.get(
    "/game/raccoon/progress",
    ...customerOnly,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const [levels, completions, replayRewards, activeSession] =
        await Promise.all([
          database.match3Level.findMany({
            where: { isActive: true },
            orderBy: { number: "asc" },
          }),
          database.match3LevelCompletion.findMany({
            where: { customerId: user.id },
            include: { level: { select: { number: true } } },
          }),
          database.match3LevelReward.findMany({
            where: { customerId: user.id },
            include: { level: { select: { number: true } } },
          }),
          findLatestSession(database, user.id),
        ]);
      const completed = new Set(completions.map(({ level }) => level.number));
      const pointsByLevel = new Map<number, number>();
      for (const reward of [...completions, ...replayRewards]) {
        pointsByLevel.set(
          reward.level.number,
          (pointsByLevel.get(reward.level.number) ?? 0) + reward.pointsAwarded,
        );
      }
      const currentLevel = nextLevelNumber(completed);
      const pendingRewards = [...completions, ...replayRewards].filter(
        ({ rewardClaimedAt }) => rewardClaimedAt === null,
      );
      response.json({
        levels: levels.map((level) => ({
          number: level.number,
          title: level.title,
          isCompleted: completed.has(level.number),
          isUnlocked: currentLevel === null || level.number <= currentLevel,
          pointsAwarded: pointsByLevel.get(level.number) ?? 0,
        })),
        completedCount: completed.size,
        currentLevel,
        totalGamePoints: [...completions, ...replayRewards].reduce(
          (sum, reward) => sum + reward.pointsAwarded,
          0,
        ),
        pendingGamePoints: pendingRewards.reduce(
          (sum, reward) => sum + reward.pointsAwarded,
          0,
        ),
        maximumGamePoints: MATCH3_TOTAL_POINTS,
        pointsPerLevel: MATCH3_POINTS_PER_LEVEL,
        activeSession: activeSession ? serializeSession(activeSession) : null,
      });
    },
  );

  router.post(
    "/game/raccoon/start",
    ...customerOnly,
    validateRequest({ body: startSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const existingActive = await database.raccoonMatch3Session.findFirst({
        where: { customerId: user.id, status: "ACTIVE" },
        include: { level: { select: { number: true } } },
        orderBy: { createdAt: "desc" },
      });
      if (existingActive) {
        response.json({ session: serializeSession(existingActive) });
        return;
      }

      const completions = await database.match3LevelCompletion.findMany({
        where: { customerId: user.id },
        include: { level: { select: { number: true } } },
      });
      const currentLevel = nextLevelNumber(
        new Set(completions.map(({ level }) => level.number)),
      );
      if (currentLevel === null) {
        throw new HttpError(
          409,
          "GAME_COMPLETE",
          "Все 100 уровней уже пройдены.",
        );
      }
      const input = request.body as z.infer<typeof startSchema>;
      const levelNumber = input.level ?? currentLevel;
      if (levelNumber > currentLevel) {
        throw new HttpError(
          409,
          "GAME_LEVEL_LOCKED",
          "Сначала пройдите предыдущие уровни.",
        );
      }
      const level = await database.match3Level.findFirst({
        where: { number: levelNumber, isActive: true },
        select: { id: true, number: true },
      });
      if (!level)
        throw new HttpError(404, "GAME_LEVEL_NOT_FOUND", "Уровень не найден.");

      try {
        const session = await database.raccoonMatch3Session.create({
          data: {
            customerId: user.id,
            levelId: level.id,
            state: createRaccoonGameState(
              level.number,
            ) as unknown as Prisma.InputJsonValue,
          },
          include: { level: { select: { number: true } } },
        });
        response.json({ session: serializeSession(session) });
      } catch (error) {
        if (!uniqueConflict(error)) throw error;
        const concurrent = await database.raccoonMatch3Session.findFirst({
          where: { customerId: user.id, status: "ACTIVE" },
          include: { level: { select: { number: true } } },
          orderBy: { createdAt: "desc" },
        });
        if (!concurrent) throw error;
        response.json({ session: serializeSession(concurrent) });
      }
    },
  );

  router.post(
    "/game/raccoon/restart",
    ...customerOnly,
    validateRequest({ body: sessionSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const { sessionId } = request.body as z.infer<typeof sessionSchema>;
      const previous = await database.raccoonMatch3Session.findFirst({
        where: {
          id: sessionId,
          customerId: user.id,
          status: { in: ["ACTIVE", "FAILED", "COMPLETE"] },
        },
        include: { level: { select: { number: true } } },
      });
      if (!previous) {
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      }
      const now = new Date();
      try {
        const updated = await database.raccoonMatch3Session.updateMany({
          where: {
            id: previous.id,
            customerId: user.id,
            updatedAt: previous.updatedAt,
          },
          data: {
            state: createRaccoonGameState(
              previous.level.number,
            ) as unknown as Prisma.InputJsonValue,
            status: "ACTIVE",
            completedAt: null,
            updatedAt: now,
          },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "GAME_SESSION_CONFLICT",
            "Игра уже обновилась. Загрузите её заново.",
          );
        }
      } catch (error) {
        if (uniqueConflict(error)) {
          throw new HttpError(
            409,
            "GAME_SESSION_ACTIVE",
            "У вас уже начат другой уровень.",
          );
        }
        throw error;
      }
      const session = await database.raccoonMatch3Session.findUnique({
        where: { id: previous.id },
        include: { level: { select: { number: true } } },
      });
      if (!session)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      response.json({ session: serializeSession(session) });
    },
  );

  router.post(
    "/game/raccoon/move",
    ...customerOnly,
    validateRequest({ body: moveSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const input = request.body as z.infer<typeof moveSchema>;
      const session = await database.raccoonMatch3Session.findFirst({
        where: { id: input.sessionId, customerId: user.id, status: "ACTIVE" },
        include: { level: { select: { number: true } } },
      });
      if (!session)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      if (!isRaccoonGameState(session.state, session.level.number)) {
        throw new HttpError(
          500,
          "GAME_SESSION_INVALID",
          "Состояние игровой сессии повреждено.",
        );
      }
      const result = applyRaccoonMove(
        session.state,
        session.level.number,
        input.from,
        input.to,
      );
      if (!result.accepted) {
        response.json({ accepted: false, session: serializeSession(session) });
        return;
      }
      const now = new Date();
      const completedAt = result.status === "COMPLETE" ? now : null;
      await database.$transaction(async (transaction) => {
        const updated = await transaction.raccoonMatch3Session.updateMany({
          where: {
            id: session.id,
            customerId: user.id,
            status: "ACTIVE",
            updatedAt: session.updatedAt,
          },
          data: {
            state: result.state as unknown as Prisma.InputJsonValue,
            status: result.status,
            updatedAt: now,
            completedAt,
          },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "GAME_SESSION_CONFLICT",
            "Игра уже обновилась. Загрузите её заново.",
          );
        }
        if (completedAt) {
          await recordMatch3LevelReward(
            transaction,
            user.id,
            session.levelId,
            result.targetCollected,
            completedAt,
          );
        }
      });
      const updatedSession = await database.raccoonMatch3Session.findUnique({
        where: { id: session.id },
        include: { level: { select: { number: true } } },
      });
      if (!updatedSession)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      response.json({
        accepted: true,
        pointsAwarded: completedAt ? MATCH3_POINTS_PER_LEVEL : 0,
        session: serializeSession(updatedSession),
      });
    },
  );

  router.post(
    "/game/raccoon/booster",
    ...customerOnly,
    validateRequest({ body: boosterSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const input = request.body as z.infer<typeof boosterSchema>;
      const session = await database.raccoonMatch3Session.findFirst({
        where: { id: input.sessionId, customerId: user.id, status: "ACTIVE" },
        include: { level: { select: { number: true } } },
      });
      if (!session)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      if (!isRaccoonGameState(session.state, session.level.number)) {
        throw new HttpError(
          500,
          "GAME_SESSION_INVALID",
          "Состояние игровой сессии повреждено.",
        );
      }
      const result = applyRaccoonBooster(
        session.state,
        session.level.number,
        input.booster,
        input.target,
      );
      if (!result.accepted) {
        response.json({ accepted: false, session: serializeSession(session) });
        return;
      }
      const now = new Date();
      const completedAt = result.status === "COMPLETE" ? now : null;
      await database.$transaction(async (transaction) => {
        const updated = await transaction.raccoonMatch3Session.updateMany({
          where: {
            id: session.id,
            customerId: user.id,
            status: "ACTIVE",
            updatedAt: session.updatedAt,
          },
          data: {
            state: result.state as unknown as Prisma.InputJsonValue,
            status: result.status,
            updatedAt: now,
            completedAt,
          },
        });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "GAME_SESSION_CONFLICT",
            "Игра уже обновилась. Загрузите её заново.",
          );
        }
        if (completedAt) {
          await recordMatch3LevelReward(
            transaction,
            user.id,
            session.levelId,
            result.targetCollected,
            completedAt,
          );
        }
      });
      const updatedSession = await database.raccoonMatch3Session.findUnique({
        where: { id: session.id },
        include: { level: { select: { number: true } } },
      });
      if (!updatedSession)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      response.json({
        accepted: true,
        pointsAwarded: completedAt ? MATCH3_POINTS_PER_LEVEL : 0,
        session: serializeSession(updatedSession),
      });
    },
  );

  router.post(
    "/game/raccoon/magnet",
    ...customerOnly,
    validateRequest({ body: sessionIdOnlySchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const { sessionId } = request.body as z.infer<typeof sessionIdOnlySchema>;
      const session = await database.raccoonMatch3Session.findFirst({
        where: { id: sessionId, customerId: user.id, status: "ACTIVE" },
        include: { level: { select: { number: true } } },
      });
      if (!session)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      if (!isRaccoonGameState(session.state, session.level.number)) {
        throw new HttpError(
          500,
          "GAME_SESSION_INVALID",
          "Состояние игровой сессии повреждено.",
        );
      }
      const result = applyRaccoonMagnet(session.state, session.level.number);
      if (!result.accepted) {
        response.json({ accepted: false, session: serializeSession(session) });
        return;
      }
      const updated = await database.raccoonMatch3Session.updateMany({
        where: {
          id: session.id,
          customerId: user.id,
          status: "ACTIVE",
          updatedAt: session.updatedAt,
        },
        data: {
          state: result.state as unknown as Prisma.InputJsonValue,
          updatedAt: new Date(),
        },
      });
      if (updated.count !== 1) {
        throw new HttpError(
          409,
          "GAME_SESSION_CONFLICT",
          "Игра уже обновилась. Загрузите её заново.",
        );
      }
      const updatedSession = await database.raccoonMatch3Session.findUnique({
        where: { id: session.id },
        include: { level: { select: { number: true } } },
      });
      if (!updatedSession)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      response.json({
        accepted: true,
        session: serializeSession(updatedSession),
      });
    },
  );

  router.post(
    "/game/raccoon/hint",
    ...customerOnly,
    validateRequest({ body: sessionSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const { sessionId } = request.body as z.infer<typeof sessionSchema>;
      const session = await database.raccoonMatch3Session.findFirst({
        where: { id: sessionId, customerId: user.id, status: "ACTIVE" },
        include: { level: { select: { number: true } } },
      });
      if (!session)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      if (!isRaccoonGameState(session.state, session.level.number)) {
        throw new HttpError(
          500,
          "GAME_SESSION_INVALID",
          "Состояние игровой сессии повреждено.",
        );
      }
      const move = getRaccoonHint(session.state, session.level.number);
      response.json({ hint: move ? { from: move[0], to: move[1] } : null });
    },
  );

  return router;
};
