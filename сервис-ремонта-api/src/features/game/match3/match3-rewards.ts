import { Prisma } from "../../../generated/prisma/client.js";
import { MATCH3_POINTS_PER_LEVEL } from "./match3-content.js";

export const recordMatch3LevelReward = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
  levelId: string,
  targetCollected: number,
  completedAt: Date,
): Promise<void> => {
  const completionCreated = await transaction.$queryRaw<Array<{ id: string }>>(
    Prisma.sql`
      INSERT INTO "match3_level_completions" (
        "id", "customer_id", "level_id", "target_collected", "points_awarded", "completed_at"
      ) VALUES (
        gen_random_uuid(), ${customerId}::uuid, ${levelId}::uuid,
        ${targetCollected}, ${MATCH3_POINTS_PER_LEVEL}, ${completedAt}
      )
      ON CONFLICT ("customer_id", "level_id") DO NOTHING
      RETURNING "id"
    `,
  );

  if (completionCreated.length > 0) return;

  await transaction.match3LevelReward.createMany({
    data: [
      {
        customerId,
        levelId,
        pointsAwarded: MATCH3_POINTS_PER_LEVEL,
        rewardClaimedAt: null,
        completedAt,
      },
    ],
    skipDuplicates: true,
  });
};

export const claimMatch3Rewards = async (
  transaction: Prisma.TransactionClient,
  customerId: string,
): Promise<{ claimedLevels: number; claimedPoints: number }> => {
  const firstCompletions = await transaction.$queryRaw<
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
  const replayCompletions = await transaction.$queryRaw<
    Array<{ points_awarded: number }>
  >(
    Prisma.sql`
      UPDATE "match3_level_rewards"
      SET "reward_claimed_at" = CURRENT_TIMESTAMP
      WHERE "customer_id" = ${customerId}::uuid
        AND "reward_claimed_at" IS NULL
      RETURNING "points_awarded"
    `,
  );
  const claimedRewards = [...firstCompletions, ...replayCompletions];
  const claimedPoints = claimedRewards.reduce(
    (sum, reward) => sum + reward.points_awarded,
    0,
  );

  if (claimedPoints > 0) {
    await transaction.loyaltyTransaction.create({
      data: {
        customerId,
        actorId: customerId,
        type: "GAME_REWARD",
        points: claimedPoints,
        reason: `Игра «Помоги еноту собрать компьютер»: награда за ${claimedRewards.length} прохождений уровней`,
      },
    });
  }

  return { claimedLevels: claimedRewards.length, claimedPoints };
};
