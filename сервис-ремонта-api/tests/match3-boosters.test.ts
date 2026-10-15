import assert from "node:assert/strict";
import { test } from "node:test";

import {
  MATCH3_BOOSTERS,
  boosterInventoryKey,
  partInventoryKey,
} from "../src/features/game/match3/match3-boosters.js";
import {
  MATCH3_PARTS,
  type Match3PartKey,
} from "../src/features/game/match3/match3-content.js";
import {
  type Match3Board,
  type Match3Tile,
  applyMatch3Booster,
  applyMatch3Move,
  findMatch3Hint,
} from "../src/features/game/match3/match3-engine.js";
import { craftMatch3Booster } from "../src/features/game/match3/match3-inventory.js";
import {
  claimMatch3Rewards,
  recordMatch3LevelReward,
} from "../src/features/game/match3/match3-rewards.js";
import { Prisma } from "../src/generated/prisma/client.js";

const tile = (kind: Match3PartKey): Match3Tile => ({
  kind,
  frozen: false,
  junk: false,
  anomalyTurns: null,
});

const board: Match3Board = Array.from({ length: 8 }, (_, row) =>
  Array.from(
    { length: 8 },
    (_, column) => MATCH3_PARTS[(row + column) % MATCH3_PARTS.length]!.key,
  ).map(tile),
);

test("each booster recipe uses distinct collected computer parts", () => {
  assert.deepEqual(MATCH3_BOOSTERS.row_rocket.recipe, {
    processor: 2,
    gpu: 2,
    power: 1,
  });
  assert.deepEqual(MATCH3_BOOSTERS.pulse_bomb.recipe, {
    ram: 2,
    ssd: 2,
    cooling: 1,
    case: 1,
  });
});

test("row rocket clears the selected row and counts target parts", () => {
  const result = applyMatch3Booster(board, "processor", "row_rocket", {
    row: 0,
    column: 3,
  });
  const expectedTargets = board[0]!.filter(
    (part) => part.kind === "processor",
  ).length;
  assert.equal(result.accepted, true);
  assert.ok(result.targetMatched >= expectedTargets);
  assert.ok(result.partsMatched.processor >= expectedTargets);
});

test("pulse bomb clears a bounded 3-by-3 area and rejects invalid coordinates", () => {
  const expectedTargets = board
    .slice(2, 5)
    .flatMap((line) => line.slice(2, 5))
    .filter((part) => part.kind === "processor").length;
  const result = applyMatch3Booster(board, "processor", "pulse_bomb", {
    row: 3,
    column: 3,
  });
  assert.equal(result.accepted, true);
  assert.ok(result.targetMatched >= expectedTargets);

  const invalid = applyMatch3Booster(board, "processor", "pulse_bomb", {
    row: 8,
    column: 3,
  });
  assert.equal(invalid.accepted, false);
});

test("question-mark hint returns a valid move that prioritizes the level target", () => {
  const checkerboard: Match3Board = Array.from({ length: 8 }, (_, row) =>
    Array.from({ length: 8 }, (_, column) =>
      tile((row + column) % 2 === 0 ? "processor" : "ram"),
    ),
  );
  const hint = findMatch3Hint(checkerboard, "processor");
  assert.ok(hint);
  const suggestedMove = applyMatch3Move(
    checkerboard,
    hint.from,
    hint.to,
    "processor",
  );
  assert.equal(suggestedMove.accepted, true);
  assert.ok(suggestedMove.targetMatched > 0);
});

test("replaying a completed level adds a separate pending reward record", async () => {
  let completionAlreadyExists = false;
  const completions: Array<Record<string, unknown>> = [];
  const replayRewards: Array<Record<string, unknown>> = [];
  const transaction = {
    $queryRaw: async (_query: unknown) => {
      const values = (_query as { values?: unknown[] }).values ?? [];
      const completedAt = values.at(-1);
      if (!completionAlreadyExists) {
        completionAlreadyExists = true;
        completions.push({ completedAt });
        return [{ id: "first-completion" }];
      }
      return [];
    },
    match3LevelReward: {
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: Array<Record<string, unknown>>;
        skipDuplicates: boolean;
      }) => {
        assert.equal(skipDuplicates, true);
        replayRewards.push(...data);
        return { count: data.length };
      },
    },
  } as unknown as Prisma.TransactionClient;

  await recordMatch3LevelReward(
    transaction,
    "customer-id",
    "level-id",
    4,
    new Date("2026-10-15T12:00:00Z"),
  );
  await recordMatch3LevelReward(
    transaction,
    "customer-id",
    "level-id",
    5,
    new Date("2026-10-15T12:05:00Z"),
  );

  assert.equal(completions.length, 1);
  assert.equal(replayRewards.length, 1);
  assert.equal(replayRewards[0]?.pointsAwarded, 10);
  assert.equal(replayRewards[0]?.rewardClaimedAt, null);
});

test("claiming first and replay rewards is idempotent and creates one loyalty entry", async () => {
  const firstPending = [{ points_awarded: 10 }, { points_awarded: 10 }];
  const replayPending = [{ points_awarded: 10 }];
  let queryCount = 0;
  const ledger: Array<{ points: number }> = [];
  const transaction = {
    $queryRaw: async () => {
      queryCount += 1;
      return queryCount % 2 === 1
        ? firstPending.splice(0)
        : replayPending.splice(0);
    },
    loyaltyTransaction: {
      create: async ({ data }: { data: { points: number } }) => {
        ledger.push({ points: data.points });
      },
    },
  } as unknown as Prisma.TransactionClient;

  assert.deepEqual(await claimMatch3Rewards(transaction, "customer-id"), {
    claimedLevels: 3,
    claimedPoints: 30,
  });
  assert.deepEqual(await claimMatch3Rewards(transaction, "customer-id"), {
    claimedLevels: 0,
    claimedPoints: 0,
  });
  assert.deepEqual(ledger, [{ points: 30 }]);
});

test("concurrent replays of one level create at most one reward per completion", async () => {
  const rewards: Array<Record<string, unknown>> = [];
  const transaction = {
    $queryRaw: async () => [],
    match3LevelReward: {
      createMany: async ({
        data,
        skipDuplicates,
      }: {
        data: Array<Record<string, unknown>>;
        skipDuplicates: boolean;
      }) => {
        assert.equal(skipDuplicates, true);
        const reward = data[0]!;
        const duplicate = rewards.some(
          (existing) =>
            existing.customerId === reward.customerId &&
            existing.levelId === reward.levelId &&
            existing.completedAt === reward.completedAt,
        );
        if (!duplicate) rewards.push(reward);
        return { count: duplicate ? 0 : 1 };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const completedAt = new Date("2026-10-15T12:05:00Z");
  await Promise.all([
    recordMatch3LevelReward(
      transaction,
      "customer-id",
      "level-id",
      5,
      completedAt,
    ),
    recordMatch3LevelReward(
      transaction,
      "customer-id",
      "level-id",
      5,
      completedAt,
    ),
  ]);

  assert.equal(rewards.length, 1);
});

test("crafting atomically spends the recipe parts and adds the booster", async () => {
  const inventory = new Map<string, number>([
    [partInventoryKey("processor"), 3],
    [partInventoryKey("gpu"), 2],
    [partInventoryKey("power"), 1],
  ]);
  const transaction = {
    match3Inventory: {
      updateMany: async ({
        where,
        data,
      }: {
        where: { itemKey: string; quantity: { gte: number } };
        data: { quantity: { decrement: number } };
      }) => {
        const quantity = inventory.get(where.itemKey) ?? 0;
        if (quantity < where.quantity.gte) return { count: 0 };
        inventory.set(where.itemKey, quantity - data.quantity.decrement);
        return { count: 1 };
      },
      upsert: async ({
        where,
        update,
        create,
      }: {
        where: { customerId_itemKey: { itemKey: string } };
        update: { quantity: { increment: number } };
        create: { itemKey: string; quantity: number };
      }) => {
        const key = where.customerId_itemKey.itemKey;
        const existing = inventory.get(key);
        inventory.set(
          key,
          existing === undefined
            ? create.quantity
            : existing + update.quantity.increment,
        );
      },
    },
  } as unknown as Prisma.TransactionClient;

  await craftMatch3Booster(transaction, "customer-id", "row_rocket");
  assert.equal(inventory.get(partInventoryKey("processor")), 1);
  assert.equal(inventory.get(partInventoryKey("gpu")), 0);
  assert.equal(inventory.get(partInventoryKey("power")), 0);
  assert.equal(inventory.get(boosterInventoryKey("row_rocket")), 1);
});
