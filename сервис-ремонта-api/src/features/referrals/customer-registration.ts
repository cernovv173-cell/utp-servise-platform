import type { Prisma } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  generateReferralCode,
  normalizeReferralCode,
} from "./referral-code.js";

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
  const referrer = referralCode
    ? await transaction.user.findUnique({
        where: { referralCode },
        select: { id: true, role: true, active: true },
      })
    : null;

  if (
    referralCode &&
    (!referrer || !referrer.active || referrer.role !== "CUSTOMER")
  ) {
    throw new HttpError(
      400,
      "REFERRAL_CODE_INVALID",
      "Код приглашения не найден или больше не активен.",
    );
  }

  const user = await transaction.user.create({
    data: {
      email: input.email,
      displayName: input.displayName,
      phoneNumber: input.phoneNumber,
      passwordHash: input.passwordHash,
      ...(input.yandexId ? { yandexId: input.yandexId } : {}),
      ...(input.vkId ? { vkId: input.vkId } : {}),
      referralCode: generateReferralCode(),
      role: "CUSTOMER",
    },
  });

  if (referrer) {
    await transaction.customerReferral.create({
      data: { referrerId: referrer.id, inviteeId: user.id },
    });
  }

  return { user, referralApplied: Boolean(referrer) };
};
