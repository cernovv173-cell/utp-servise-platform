import { Router } from "express";

import { Prisma } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../../lib/database/database.js";
import { HttpError } from "../../../lib/http/http-error.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../../auth/auth.middleware.js";
import { MATCH3_BOOSTERS, MATCH3_BOOSTER_KEYS } from "./match3-boosters.js";
import {
  MATCH3_LEVEL_COUNT,
  MATCH3_TOTAL_POINTS,
  getMatch3Part,
} from "./match3-content.js";
import { createMatch3CosmeticRouter } from "./match3-cosmetic.routes.js";
import { createMatch3EconomyRouter } from "./match3-economy.routes.js";
import { createMatch3Board } from "./match3-engine.js";
import { getMatch3Inventory } from "./match3-inventory.js";
import { createMatch3PlayRouter } from "./match3-play.routes.js";
import {
  serializeMatch3Level,
  serializeMatch3Session,
} from "./match3-serialization.js";

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
  router.use(createMatch3EconomyRouter(database));
  router.use(createMatch3PlayRouter(database));
  const requireAuth = createRequireAuth(database);
  const customerOnly = [requireAuth, requireRoles("CUSTOMER")];

  router.get(
    "/game/match3/progress",
    ...customerOnly,
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const [levels, completions, replayRewards, activeSession, inventory] =
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
          database.match3GameSession.findFirst({
            where: {
              customerId: user.id,
              status: { in: ["ACTIVE", "FAILED", "COMPLETE"] },
            },
            include: { level: true },
            orderBy: { createdAt: "desc" },
          }),
          getMatch3Inventory(database, user.id),
        ]);
      const completedNumbers = new Set(
        completions.map((completion) => completion.level.number),
      );
      const pointsByLevel = new Map<number, number>();
      for (const reward of [...completions, ...replayRewards]) {
        pointsByLevel.set(
          reward.level.number,
          (pointsByLevel.get(reward.level.number) ?? 0) + reward.pointsAwarded,
        );
      }
      const next = nextLevelNumber(completedNumbers);
      response.json({
        levels: levels.map((level) => ({
          ...serializeMatch3Level(level),
          isCompleted: completedNumbers.has(level.number),
          isUnlocked: next !== null && level.number <= next,
          pointsAwarded: pointsByLevel.get(level.number) ?? 0,
        })),
        completedCount: completedNumbers.size,
        currentLevel: next,
        totalGamePoints: [...completions, ...replayRewards].reduce(
          (total, reward) => total + reward.pointsAwarded,
          0,
        ),
        pendingGamePoints: [...completions, ...replayRewards]
          .filter((reward) => reward.rewardClaimedAt === null)
          .reduce((total, reward) => total + reward.pointsAwarded, 0),
        maximumGamePoints: MATCH3_TOTAL_POINTS,
        inventory,
        boosterCatalog: MATCH3_BOOSTER_KEYS.map((id) => ({
          id,
          ...MATCH3_BOOSTERS[id],
          recipe: Object.entries(MATCH3_BOOSTERS[id].recipe).map(
            ([part, quantity]) => ({
              part,
              name: getMatch3Part(part).name,
              icon: getMatch3Part(part).icon,
              quantity,
            }),
          ),
        })),
        activeSession: activeSession
          ? serializeMatch3Session(activeSession)
          : null,
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
        response.json({ session: serializeMatch3Session(activeSession) });
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
        response.status(201).json({ session: serializeMatch3Session(session) });
      } catch (error) {
        if (!isUniqueConstraintError(error)) throw error;
        const racedSession = await database.match3GameSession.findFirst({
          where: { customerId: user.id, status: "ACTIVE" },
          include: { level: true },
          orderBy: { createdAt: "desc" },
        });
        if (!racedSession) throw error;
        response.json({ session: serializeMatch3Session(racedSession) });
      }
    },
  );

  return router;
};
