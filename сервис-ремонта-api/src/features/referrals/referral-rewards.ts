import type { Prisma } from "../../generated/prisma/client.js";

export const REFERRAL_REWARD_POINTS = 100;

type AwardReferralInput = {
  readonly inviteeId: string;
  readonly orderId: string;
  readonly serviceNumber: string;
  readonly actorId: string;
};

export const awardReferralForFirstPaidRepair = async (
  transaction: Prisma.TransactionClient,
  input: AwardReferralInput,
): Promise<boolean> => {
  const referral = await transaction.customerReferral.findUnique({
    where: { inviteeId: input.inviteeId },
    select: { id: true, referrerId: true, status: true },
  });
  if (!referral || referral.status !== "PENDING") return false;

  const claimed = await transaction.customerReferral.updateMany({
    where: { id: referral.id, status: "PENDING" },
    data: {
      status: "REWARDED",
      rewardedAt: new Date(),
      rewardOrderId: input.orderId,
    },
  });
  if (claimed.count !== 1) return false;

  const reason = `Награда за приглашение: первый завершённый и оплаченный ремонт ${input.serviceNumber}`;
  await transaction.loyaltyTransaction.createMany({
    data: [
      {
        customerId: referral.referrerId,
        orderId: input.orderId,
        referralId: referral.id,
        actorId: input.actorId,
        type: "REFERRAL_REWARD",
        points: REFERRAL_REWARD_POINTS,
        reason,
      },
      {
        customerId: input.inviteeId,
        orderId: input.orderId,
        referralId: referral.id,
        actorId: input.actorId,
        type: "REFERRAL_REWARD",
        points: REFERRAL_REWARD_POINTS,
        reason: `Приветственные баллы за первый завершённый и оплаченный ремонт ${input.serviceNumber}`,
      },
    ],
    skipDuplicates: true,
  });
  return true;
};
