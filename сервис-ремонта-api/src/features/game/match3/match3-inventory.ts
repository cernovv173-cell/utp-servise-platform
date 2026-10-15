import { Prisma } from "../../../generated/prisma/client.js";
import type { DatabaseClient } from "../../../lib/database/database.js";
import { HttpError } from "../../../lib/http/http-error.js";
import {
  MATCH3_BOOSTERS,
  MATCH3_BOOSTER_KEYS,
  type Match3BoosterKey,
  boosterInventoryKey,
  partInventoryKey,
} from "./match3-boosters.js";
import { MATCH3_PARTS, type Match3PartKey } from "./match3-content.js";
import type { Match3MoveResult } from "./match3-engine.js";

export type Match3InventorySnapshot = {
  parts: Record<Match3PartKey, number>;
  boosters: Record<Match3BoosterKey, number>;
};

export const emptyMatch3Inventory = (): Match3InventorySnapshot => ({
  parts: Object.fromEntries(MATCH3_PARTS.map(({ key }) => [key, 0])) as Record<
    Match3PartKey,
    number
  >,
  boosters: Object.fromEntries(
    MATCH3_BOOSTER_KEYS.map((key) => [key, 0]),
  ) as Record<Match3BoosterKey, number>,
});

export const getMatch3Inventory = async (
  database: DatabaseClient,
  customerId: string,
): Promise<Match3InventorySnapshot> => {
  const rows = await database.match3Inventory.findMany({
    where: { customerId },
  });
  const inventory = emptyMatch3Inventory();
  for (const row of rows) {
    if (row.itemKey.startsWith("part:")) {
      const key = row.itemKey.slice(5) as Match3PartKey;
      if (key in inventory.parts) inventory.parts[key] = row.quantity;
    } else if (row.itemKey.startsWith("booster:")) {
      const key = row.itemKey.slice(8) as Match3BoosterKey;
      if (key in inventory.boosters) inventory.boosters[key] = row.quantity;
    }
  }
  return inventory;
};

export const incrementMatch3Item = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
  itemKey: string,
  quantity: number,
): Promise<void> => {
  if (quantity <= 0) return;
  await transaction.match3Inventory.upsert({
    where: { customerId_itemKey: { customerId, itemKey } },
    update: { quantity: { increment: quantity } },
    create: { customerId, itemKey, quantity },
  });
};

export const recordMatchedParts = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
  result: Pick<Match3MoveResult, "partsMatched">,
): Promise<void> => {
  for (const part of MATCH3_PARTS) {
    const quantity = result.partsMatched[part.key];
    if (quantity > 0) {
      await incrementMatch3Item(
        transaction,
        customerId,
        partInventoryKey(part.key),
        quantity,
      );
    }
  }
};

export const consumeMatch3Booster = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
  boosterId: Match3BoosterKey,
): Promise<void> => {
  const changed = await transaction.match3Inventory.updateMany({
    where: {
      customerId,
      itemKey: boosterInventoryKey(boosterId),
      quantity: { gte: 1 },
    },
    data: { quantity: { decrement: 1 } },
  });
  if (changed.count !== 1) {
    throw new HttpError(
      409,
      "BOOSTER_UNAVAILABLE",
      "У вас нет такого бустера.",
    );
  }
};

export const craftMatch3Booster = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
  boosterId: Match3BoosterKey,
): Promise<void> => {
  const recipe = MATCH3_BOOSTERS[boosterId].recipe;
  for (const [part, quantity] of Object.entries(recipe) as [
    Match3PartKey,
    number,
  ][]) {
    const changed = await transaction.match3Inventory.updateMany({
      where: {
        customerId,
        itemKey: partInventoryKey(part),
        quantity: { gte: quantity },
      },
      data: { quantity: { decrement: quantity } },
    });
    if (changed.count !== 1) {
      throw new HttpError(
        409,
        "MATCH3_RECIPE_INCOMPLETE",
        `Недостаточно деталей «${part}» для сборки бустера.`,
      );
    }
  }
  await incrementMatch3Item(
    transaction,
    customerId,
    boosterInventoryKey(boosterId),
    1,
  );
};

export const claimMatch3Rewards = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
): Promise<{ claimedLevels: number; claimedPoints: number }> => {
  const claimed = await transaction.$queryRaw<
    Array<{ points_awarded: number }>
  >(
    Prisma.sql`
      UPDATE "match3_level_completions"
      SET "reward_claimed_at" = CURRENT_TIMESTAMP
      WHERE "customer_id" = ${customerId}::uuid
        AND "reward_claimed_at" IS NULL
      RETURNING "points_awarded"
    `,
  );
  const claimedPoints = claimed.reduce(
    (sum, row) => sum + row.points_awarded,
    0,
  );
  if (claimedPoints > 0) {
    await transaction.loyaltyTransaction.create({
      data: {
        customerId,
        actorId: customerId,
        type: "GAME_REWARD",
        points: claimedPoints,
        reason: `Игра «Помоги еноту собрать компьютер»: награда за ${claimed.length} пройденных уровней`,
      },
    });
  }
  return { claimedLevels: claimed.length, claimedPoints };
};
