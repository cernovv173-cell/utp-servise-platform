import type { Prisma } from "../../generated/prisma/client.js";
import { Prisma as PrismaNamespace } from "../../generated/prisma/client.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  REFERRAL_CODE_COUNT,
  REFERRAL_CODE_VALIDITY_MONTHS,
  addCalendarMonths,
  generateReferralCode,
} from "./referral-code.js";

const unavailableError = () =>
  new HttpError(
    503,
    "REFERRAL_CODES_UNAVAILABLE",
    "Не удалось подготовить коды приглашения. Попробуйте позже.",
  );

export const ensureCustomerReferralCodes = async (
  transaction: Prisma.TransactionClient,
  ownerId: string,
  now = new Date(),
) => {
  await transaction.$queryRaw(
    PrismaNamespace.sql`SELECT "id" FROM "users" WHERE "id" = ${ownerId}::uuid FOR UPDATE`,
  );

  const owner = await transaction.user.findUnique({
    where: { id: ownerId },
    select: { id: true, role: true, active: true, referralCode: true },
  });
  if (!owner || owner.role !== "CUSTOMER" || !owner.active) {
    throw new HttpError(
      403,
      "CUSTOMER_UNAVAILABLE",
      "Коды приглашения доступны только активным клиентам.",
    );
  }

  let codes = await transaction.customerReferralCode.findMany({
    where: { ownerId },
    orderBy: { slot: "asc" },
    select: {
      id: true,
      ownerId: true,
      slot: true,
      code: true,
      issuedAt: true,
      expiresAt: true,
      claimedAt: true,
    },
  });

  if (codes.length < REFERRAL_CODE_COUNT) {
    const priorReferralCount = codes.length
      ? 0
      : await transaction.customerReferral.count({
          where: { referrerId: ownerId },
        });
    const canonicalCode = codes.find(({ slot }) => slot === 1) ?? codes[0];
    const issuedAt = canonicalCode?.issuedAt ?? now;
    const expiresAt =
      canonicalCode?.expiresAt ??
      addCalendarMonths(issuedAt, REFERRAL_CODE_VALIDITY_MONTHS);
    const occupiedSlots = new Set(codes.map(({ slot }) => slot));

    for (
      let attempt = 0;
      attempt < 5 && codes.length < REFERRAL_CODE_COUNT;
      attempt += 1
    ) {
      const missingSlots = Array.from(
        { length: REFERRAL_CODE_COUNT },
        (_, index) => index + 1,
      ).filter((slot) => !occupiedSlots.has(slot));
      if (!missingSlots.length) break;

      await transaction.customerReferralCode.createMany({
        data: missingSlots.map((slot) => ({
          ownerId,
          slot,
          code:
            slot === 1 &&
            attempt === 0 &&
            owner.referralCode &&
            priorReferralCount === 0
              ? owner.referralCode
              : generateReferralCode(),
          issuedAt,
          expiresAt,
        })),
        skipDuplicates: true,
      });

      codes = await transaction.customerReferralCode.findMany({
        where: { ownerId },
        orderBy: { slot: "asc" },
        select: {
          id: true,
          ownerId: true,
          slot: true,
          code: true,
          issuedAt: true,
          expiresAt: true,
          claimedAt: true,
        },
      });
      for (const code of codes) occupiedSlots.add(code.slot);
    }
  }

  const primaryCode = codes.find(({ slot }) => slot === 1);
  if (codes.length !== REFERRAL_CODE_COUNT || !primaryCode) {
    throw unavailableError();
  }

  if (owner.referralCode !== primaryCode.code) {
    await transaction.user.update({
      where: { id: ownerId },
      data: { referralCode: primaryCode.code },
    });
  }

  return codes;
};
