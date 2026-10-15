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
  type Match3BoosterKey,
  boosterInventoryKey,
  giftForCompletedLevel,
  isMatch3BoosterKey,
} from "./match3-boosters.js";
import {
  MATCH3_LEVEL_COUNT,
  MATCH3_POINTS_PER_LEVEL,
  getMatch3TargetPart,
} from "./match3-content.js";
import {
  type Match3Position,
  applyMatch3Booster,
  applyMatch3Move,
  createMatch3Board,
  findMatch3Hint,
  isMatch3Board,
} from "./match3-engine.js";
import {
  consumeMatch3Booster,
  incrementMatch3Item,
  recordMatchedParts,
} from "./match3-inventory.js";
import { serializeMatch3Session } from "./match3-serialization.js";

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

const useBoosterSchema = z.object({
  boosterId: z.string().refine(isMatch3BoosterKey),
  sessionId: z.string().uuid(),
  row: z.number().int().min(0).max(7),
  column: z.number().int().min(0).max(7),
});

const hintSchema = z.object({ sessionId: z.string().uuid() });
const restartSchema = z.object({ sessionId: z.string().uuid() });

const isUniqueConstraintError = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "code" in error &&
  error.code === "P2002";

const completeMatch3Level = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
  levelId: string,
  levelNumber: number,
  targetCollected: number,
  completedAt: Date,
): Promise<Match3BoosterKey> => {
  await transaction.match3LevelCompletion.create({
    data: {
      customerId,
      levelId,
      targetCollected,
      pointsAwarded: MATCH3_POINTS_PER_LEVEL,
      rewardClaimedAt: null,
      completedAt,
    },
  });
  const boosterAwarded = giftForCompletedLevel(levelNumber);
  await incrementMatch3Item(
    transaction,
    customerId,
    boosterInventoryKey(boosterAwarded),
    1,
  );
  return boosterAwarded;
};

export const createMatch3PlayRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const customerOnly = [createRequireAuth(database), requireRoles("CUSTOMER")];

  router.post(
    "/game/match3/restart",
    ...customerOnly,
    validateRequest({ body: restartSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const { sessionId } = request.body as z.infer<typeof restartSchema>;
      const previous = await database.match3GameSession.findFirst({
        where: {
          id: sessionId,
          customerId: user.id,
          status: { in: ["ACTIVE", "FAILED"] },
        },
        include: { level: true },
      });
      if (!previous) {
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Текущая попытка не найдена.",
        );
      }

      const completion = await database.match3LevelCompletion.findUnique({
        where: {
          customerId_levelId: {
            customerId: user.id,
            levelId: previous.levelId,
          },
        },
        select: { id: true },
      });
      if (completion) {
        throw new HttpError(
          409,
          "GAME_LEVEL_ALREADY_COMPLETED",
          "Пройденный уровень и его награды нельзя сбросить.",
        );
      }

      try {
        const restarted = await database.$transaction(async (transaction) => {
          const closed = await transaction.match3GameSession.updateMany({
            where: {
              id: previous.id,
              customerId: user.id,
              status: previous.status,
            },
            data: { status: "ABANDONED" },
          });
          if (closed.count !== 1) {
            throw new HttpError(
              409,
              "GAME_RESTART_CONFLICT",
              "Попытка уже обновилась. Загрузите игру заново.",
            );
          }
          return transaction.match3GameSession.create({
            data: {
              customerId: user.id,
              levelId: previous.levelId,
              board: createMatch3Board(
                previous.level.number,
              ) as unknown as Prisma.InputJsonValue,
            },
            include: { level: true },
          });
        });
        response.json({ session: serializeMatch3Session(restarted) });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const activeSession = await database.match3GameSession.findFirst({
          where: { customerId: user.id, status: "ACTIVE" },
          include: { level: true },
          orderBy: { createdAt: "desc" },
        });
        if (!activeSession) throw error;
        response.json({ session: serializeMatch3Session(activeSession) });
      }
    },
  );

  router.post(
    "/game/match3/hint",
    ...customerOnly,
    validateRequest({ body: hintSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const input = request.body as z.infer<typeof hintSchema>;
      const session = await database.match3GameSession.findFirst({
        where: { id: input.sessionId, customerId: user.id, status: "ACTIVE" },
        include: { level: true },
      });
      if (!session) {
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      }
      if (!isMatch3Board(session.board)) {
        throw new HttpError(
          500,
          "GAME_SESSION_INVALID",
          "Не удалось загрузить игровое поле.",
        );
      }
      response.json({
        hint: findMatch3Hint(
          session.board,
          getMatch3TargetPart(session.level.number),
        ),
      });
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
      if (!session) {
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      }
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
        response.json({
          accepted: false,
          session: serializeMatch3Session(session),
        });
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

        await recordMatchedParts(transaction, user.id, move);
        const boosterAwarded = completed
          ? await completeMatch3Level(
              transaction,
              user.id,
              session.levelId,
              session.level.number,
              targetCollected,
              completedAt!,
            )
          : null;
        return {
          session: await transaction.match3GameSession.findUniqueOrThrow({
            where: { id: session.id },
            include: { level: true },
          }),
          boosterAwarded,
        };
      });
      response.json({
        accepted: true,
        targetMatched: move.targetMatched,
        partsMatched: move.partsMatched,
        obstaclesCleared: move.obstaclesCleared,
        obstaclesUnlocked: move.obstaclesUnlocked,
        pointsAwarded: completed ? MATCH3_POINTS_PER_LEVEL : 0,
        boosterAwarded: updated.boosterAwarded,
        gameComplete: completed && session.level.number === MATCH3_LEVEL_COUNT,
        session: serializeMatch3Session(updated.session),
      });
    },
  );

  router.post(
    "/game/match3/booster/use",
    ...customerOnly,
    validateRequest({ body: useBoosterSchema }),
    async (request, response) => {
      const user = getAuthenticatedUser(response);
      const input = request.body as z.infer<typeof useBoosterSchema>;
      const boosterId = input.boosterId as Match3BoosterKey;
      const session = await database.match3GameSession.findFirst({
        where: { id: input.sessionId, customerId: user.id, status: "ACTIVE" },
        include: { level: true },
      });
      if (!session) {
        throw new HttpError(
          404,
          "GAME_SESSION_NOT_FOUND",
          "Игровая сессия не найдена.",
        );
      }
      if (!isMatch3Board(session.board)) {
        throw new HttpError(
          500,
          "GAME_SESSION_INVALID",
          "Не удалось загрузить игровое поле.",
        );
      }

      const move = applyMatch3Booster(
        session.board,
        getMatch3TargetPart(session.level.number),
        boosterId,
        { row: input.row, column: input.column },
      );
      const targetCollected = session.targetCollected + move.targetMatched;
      const movesUsed = session.movesUsed + 1;
      const completed = targetCollected >= session.level.targetCount;
      const failed = !completed && movesUsed >= session.level.moveLimit;
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
            status: completed ? "COMPLETE" : failed ? "FAILED" : "ACTIVE",
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
        await consumeMatch3Booster(transaction, user.id, boosterId);
        await recordMatchedParts(transaction, user.id, move);
        const boosterAwarded = completed
          ? await completeMatch3Level(
              transaction,
              user.id,
              session.levelId,
              session.level.number,
              targetCollected,
              completedAt!,
            )
          : null;
        return {
          session: await transaction.match3GameSession.findUniqueOrThrow({
            where: { id: session.id },
            include: { level: true },
          }),
          boosterAwarded,
        };
      });
      response.json({
        accepted: true,
        boosterUsed: boosterId,
        boosterAwarded: updated.boosterAwarded,
        targetMatched: move.targetMatched,
        partsMatched: move.partsMatched,
        pointsAwarded: completed ? MATCH3_POINTS_PER_LEVEL : 0,
        gameComplete: completed && session.level.number === MATCH3_LEVEL_COUNT,
        session: serializeMatch3Session(updated.session),
      });
    },
  );

  return router;
};
