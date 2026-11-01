import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http/http-error.js";
import { ensureCustomerReferralCodes } from "./customer-referral-codes.js";
import { normalizeReferralCode } from "./referral-code.js";

const invalidReferralCode = () =>
  new HttpError(
    400,
    "REFERRAL_CODE_INVALID",
    "Код приглашения истёк, уже использован или больше не активен.",
  );

type CustomerRegistrationInput = {
  readonly email: string;
  readonly displayName: string;
  readonly phoneNumber: string | null;
  readonly passwordHash: string;
  readonly yandexId?: string | undefined;
  readonly vkId?: string | undefined;
  readonly referralCode?: string | undefined;
};

export const createCustomerWithReferral = async (
  transaction: Prisma.TransactionClient,
  input: CustomerRegistrationInput,
) => {
  const referralCode = input.referralCode
    ? normalizeReferralCode(input.referralCode)
    : undefined;
  let referrer: { id: string; role: string; active: boolean } | null = null;
  let promoCodeId: string | undefined;

  if (referralCode) {
    const now = new Date();
    let promoCode = await transaction.customerReferralCode.findUnique({
      where: { code: referralCode },
      select: {
        id: true,
        ownerId: true,
        slot: true,
        issuedAt: true,
        expiresAt: true,
        claimedAt: true,
      },
    });

    if (!promoCode) {
      const legacyOwner = await transaction.user.findUnique({
        where: { referralCode },
        select: { id: true, role: true, active: true },
      });
      if (
        !legacyOwner ||
        !legacyOwner.active ||
        legacyOwner.role !== "CUSTOMER"
      ) {
        throw invalidReferralCode();
      }

      const issuedCodes = await ensureCustomerReferralCodes(
        transaction,
        legacyOwner.id,
        now,
      );
      promoCode = issuedCodes.find(({ code }) => code === referralCode) ?? null;
      if (!promoCode) throw invalidReferralCode();
      referrer = legacyOwner;
    } else {
      referrer = await transaction.user.findUnique({
        where: { id: promoCode.ownerId },
        select: { id: true, role: true, active: true },
      });
    }

    if (
      !promoCode ||
      !referrer ||
      !referrer.active ||
      referrer.role !== "CUSTOMER" ||
      promoCode.claimedAt ||
      promoCode.expiresAt <= now
    ) {
      throw invalidReferralCode();
    }

    const existingRedemption = await transaction.customerReferral.findFirst({
      where: { promoCodeId: promoCode.id },
      select: { id: true },
    });
    if (existingRedemption) throw invalidReferralCode();

    if (promoCode.slot === 1) {
      const legacyRedemption = await transaction.customerReferral.findFirst({
        where: {
          referrerId: promoCode.ownerId,
          promoCodeId: null,
          createdAt: { gte: promoCode.issuedAt },
        },
        select: { id: true },
      });
      if (legacyRedemption) throw invalidReferralCode();
    }

    const claimed = await transaction.customerReferralCode.updateMany({
      where: {
        id: promoCode.id,
        claimedAt: null,
        expiresAt: { gt: now },
      },
      data: { claimedAt: now },
    });
    if (claimed.count !== 1) throw invalidReferralCode();
    promoCodeId = promoCode.id;
  }

  const user = await transaction.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,
      phoneNumber: input.phoneNumber,
      passwordHash: input.passwordHash,
      ...(input.yandexId ? { yandexId: input.yandexId } : {}),
      ...(input.vkId ? { vkId: input.vkId } : {}),
      role: "CUSTOMER",
    },
  });

  if (referrer) {
    await transaction.customerReferral.create({
      data: {
        referrerId: referrer.id,
        inviteeId: user.id,
        promoCodeId,
      },
    });
  }

  return { user, referralApplied: Boolean(referrer) };
};
