import assert from "node:assert/strict";
import test from "node:test";

import {
  REFERRAL_REWARD_POINTS,
  awardReferralForFirstPaidRepair,
} from "../src/features/referrals/referral-rewards.js";
import type { Prisma } from "../src/generated/prisma/client.js";

test("first paid repair awards 250 points to both customers only once", async () => {
  let status: "PENDING" | "REWARDED" = "PENDING";
  const transactions: Array<Record<string, unknown>> = [];
  const transaction = {
    customerReferral: {
      findUnique: async () =>
        status === "PENDING"
          ? { id: "referral-1", referrerId: "referrer-1", status }
          : { id: "referral-1", referrerId: "referrer-1", status },
      updateMany: async () => {
        if (status !== "PENDING") return { count: 0 };
        status = "REWARDED";
        return { count: 1 };
      },
    },
    loyaltyTransaction: {
      createMany: async ({
        data,
      }: {
        data: Array<Record<string, unknown>>;
      }) => {
        transactions.push(...data);
        return { count: data.length };
      },
    },
  } as unknown as Prisma.TransactionClient;

  const input = {
    inviteeId: "invitee-1",
    orderId: "order-1",
    serviceNumber: "SRV-2026-000001",
    actorId: "admin-1",
  };
  const concurrentClaims = await Promise.all([
    awardReferralForFirstPaidRepair(transaction, input),
    awardReferralForFirstPaidRepair(transaction, input),
  ]);
  assert.equal(concurrentClaims.filter(Boolean).length, 1);
  assert.equal(
    await awardReferralForFirstPaidRepair(transaction, input),
    false,
  );
  assert.equal(transactions.length, 2);
  assert.deepEqual(
    transactions.map(({ customerId, points, type }) => ({
      customerId,
      points,
      type,
    })),
    [
      {
        customerId: "referrer-1",
        points: REFERRAL_REWARD_POINTS,
        type: "REFERRAL_REWARD",
      },
      {
        customerId: "invitee-1",
        points: REFERRAL_REWARD_POINTS,
        type: "REFERRAL_REWARD",
      },
    ],
  );
});
