import { Router } from "express";
import { z } from "zod";

import { Prisma } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../../lib/database/database.js";
import { HttpError } from "../../../lib/http/http-error.js";
import { validateRequest } from "../../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../../auth/auth.middleware.js";
import {
  MATCH3_LEVEL_COUNT,
  MATCH3_POINTS_PER_LEVEL,
  MATCH3_TOTAL_POINTS,
  getMatch3Chapter,
  getMatch3Part,
  getMatch3TargetPart,
} from "./match3-content.js";
import { createMatch3CosmeticRouter } from "./match3-cosmetic.routes.js";
import {
  type Match3Position,
  applyMatch3Move,
  createMatch3Board,
  isMatch3Board,
} from "./match3-engine.js";

const moveSchema = z.object({
  sessionId: z.string().uuid(),
  from: z.object({
    row: z.number().int().min(0).max(7),
    column: z.number().int().min(0).max(7),
  }),
  to: z.object({
    row: z.number().int().min(0).max(7),
    column: z.number().int().min(0).max(7),
  }),
});

type LevelRecord = {
  id: string;
  number: number;
  title: string;
  targetPart: string;
  targetCount: number;
  moveLimit: number;
  isActive: boolean;
};

type SessionRecord = {
  id: string;
  levelId: string;
  board: Prisma.JsonValue;
  targetCollected: number;
  movesUsed: number;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
  level: LevelRecord;
};

const serializeLevel = (level: LevelRecord) => {
  const targetPart = getMatch3TargetPart(level.number);
  const part = getMatch3Part(targetPart);
  return {
    id: level.id,
    number: level.number,
    title: `Этап ${level.number} — ${part.name}`,
    targetPart,
    targetPartName: part.name,
    targetPartIcon: part.icon,
    targetCount: level.targetCount,
    moveLimit: level.moveLimit,
    chapter: getMatch3Chapter(level.number),
  };
};

const serializeSession = (session: SessionRecord) => {
  if (!isMatch3Board(session.board)) {
    throw new HttpError(
      500,
      "GAME_SESSION_INVALID",
      "Не удалось загрузить игровое поле.",
    );
  }
  return {
    id: session.id,
    board: session.board,
    targetCollected: session.targetCollected,
    movesUsed: session.movesUsed,
    status: session.status,
    completedAt: session.completedAt,
    level: serializeLevel(session.level),
  };
};

const nextLevelNumber = (completedNumbers: Set<number>) => {
  for (let number = 1; number <= MATCH3_LEVEL_COUNT; number += 1) {
    if (!completedNumbers.has(number)) return number;
  }
  return null;
};

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

export const createMatch3Router = (database: DatabaseClient): Router => {
  const router = Router();
  router.use(createMatch3CosmeticRouter(database));
  const requireAuth = createRequireAuth(database);
  const customerOnly = [requireAuth, requireRoles("CUSTOMER")];

  router.get(
    "/game/match3/progress",
    ...customerOnly,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const [levels, completions, activeSession] = await Promise.all([
        database.match3Level.findMany({
          where: { isActive: true },
          orderBy: { number: "asc" },
        }),
        database.match3LevelCompletion.findMany({
          where: { customerId: user.id },
          include: { level: { select: { number: true } } },
        }),
        database.match3GameSession.findFirst({
          where: { customerId: user.id, status: "ACTIVE" },
          include: { level: true },
          orderBy: { createdAt: "desc" },
        }),
      ]);
      const completedNumbers = new Set(
        completions.map((completion) => completion.level.number),
      );
      const next = nextLevelNumber(completedNumbers);
      response.json({
        levels: levels.map((level) => ({
          ...serializeLevel(level),
          isCompleted: completedNumbers.has(level.number),
          isUnlocked: next !== null && level.number <= next,
          pointsAwarded:
            completions.find(
              (completion) => completion.level.number === level.number,
            )?.pointsAwarded ?? 0,
        })),
        completedCount: completedNumbers.size,
        currentLevel: next,
        totalGamePoints: completions.reduce(
          (total, completion) => total + completion.pointsAwarded,
          0,
        ),
        maximumGamePoints: MATCH3_TOTAL_POINTS,
        activeSession: activeSession ? serializeSession(activeSession) : null,
      });
    },
  );

  router.post(
    "/game/match3/start",
    ...customerOnly,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const activeSession = await database.match3GameSession.findFirst({
        where: { customerId: user.id, status: "ACTIVE" },
        include: { level: true },
        orderBy: { createdAt: "desc" },
      });
      if (activeSession) {
        response.json({ session: serializeSession(activeSession) });
        return;
      }

      const completed = await database.match3LevelCompletion.findMany({
        where: { customerId: user.id },
        include: { level: { select: { number: true } } },
      });
      const number = nextLevelNumber(
        new Set(completed.map((entry) => entry.level.number)),
      );
      if (number === null) {
        throw new HttpError(
          409,
          "GAME_COMPLETE",
          "Все 100 уровней уже пройдены.",
        );
      }
      const level = await database.match3Level.findFirst({
        where: { number, isActive: true },
      });
      if (!level)
        throw new HttpError(
          404,
          "GAME_LEVEL_NOT_FOUND",
          "Уровень временно недоступен.",
        );

      try {
        const session = await database.match3GameSession.create({
          data: {
            customerId: user.id,
            levelId: level.id,
            board: createMatch3Board(
              number,
            ) as unknown as Prisma.InputJsonValue,
          },
          include: { level: true },
        });
        response.status(201).json({ session: serializeSession(session) });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const racedSession = await database.match3GameSession.findFirst({
          where: { customerId: user.id, status: "ACTIVE" },
          include: { level: true },
          orderBy: { createdAt: "desc" },
        });
        if (!racedSession) throw error;
        response.json({ session: serializeSession(racedSession) });
      }
    },
  );

  router.post(
    "/game/match3/move",
    ...customerOnly,
    validateRequest({ body: moveSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const input = request.body as z.infer<typeof moveSchema>;
      const session = await database.match3GameSession.findFirst({
        where: { id: input.sessionId, customerId: user.id, status: "ACTIVE" },
        include: { level: true },
      });
      if (!session)
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      if (!isMatch3Board(session.board)) {
        throw new HttpError(
          500,
          "GAME_SESSION_INVALID",
          "Не удалось загрузить игровое поле.",
        );
      }

      const targetPart = getMatch3TargetPart(session.level.number);
      const move = applyMatch3Move(
        session.board,
        input.from as Match3Position,
        input.to as Match3Position,
        targetPart,
      );
      if (!move.accepted) {
        response.json({ accepted: false, session: serializeSession(session) });
        return;
      }

      const targetCollected = session.targetCollected + move.targetMatched;
      const movesUsed = session.movesUsed + 1;
      const completed = targetCollected >= session.level.targetCount;
      const failed = !completed && movesUsed >= session.level.moveLimit;
      const status = completed ? "COMPLETE" : failed ? "FAILED" : "ACTIVE";
      const completedAt = completed ? new Date() : null;

      const updated = await database.$transaction(async (transaction) => {
        const changed = await transaction.match3GameSession.updateMany({
          where: {
            id: session.id,
            customerId: user.id,
            status: "ACTIVE",
            movesUsed: session.movesUsed,
          },
          data: {
            board: move.board as unknown as Prisma.InputJsonValue,
            targetCollected,
            movesUsed,
            status,
            completedAt,
          },
        });
        if (changed.count !== 1) {
          throw new HttpError(
            409,
            "GAME_MOVE_CONFLICT",
            "Партия обновилась. Загрузите её заново.",
          );
        }

        if (completed) {
          await transaction.match3LevelCompletion.create({
            data: {
              customerId: user.id,
              levelId: session.levelId,
              targetCollected,
              pointsAwarded: MATCH3_POINTS_PER_LEVEL,
              rewardClaimedAt: completedAt,
              completedAt: completedAt!,
            },
          });
          await transaction.loyaltyTransaction.create({
            data: {
              customerId: user.id,
              actorId: user.id,
              type: "GAME_REWARD",
              points: MATCH3_POINTS_PER_LEVEL,
              reason: `Игра «Помоги еноту собрать компьютер»: уровень ${session.level.number}`,
            },
          });
        }
        return transaction.match3GameSession.findUniqueOrThrow({
          where: { id: session.id },
          include: { level: true },
        });
      });
      response.json({
        accepted: true,
        targetMatched: move.targetMatched,
        obstaclesCleared: move.obstaclesCleared,
        obstaclesUnlocked: move.obstaclesUnlocked,
        pointsAwarded: completed ? MATCH3_POINTS_PER_LEVEL : 0,
        gameComplete: completed && session.level.number === MATCH3_LEVEL_COUNT,
        session: serializeSession(updated),
      });
    },
  );

  return router;
};
