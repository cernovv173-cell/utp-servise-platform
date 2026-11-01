import { Router } from "express";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { ensureCustomerReferralCodes } from "./customer-referral-codes.js";
import {
  REFERRAL_CODE_COUNT,
  REFERRAL_CODE_VALIDITY_MONTHS,
} from "./referral-code.js";
import { REFERRAL_REWARD_POINTS } from "./referral-rewards.js";

export const createReferralRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/referrals/me",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const codes = await database.$transaction((transaction) =>
        ensureCustomerReferralCodes(transaction, user.id),
      );
      const primaryCode = codes.find(({ slot }) => slot === 1);
      if (!primaryCode) {
        throw new HttpError(
          503,
          "REFERRAL_CODE_UNAVAILABLE",
          "Не удалось подготовить ссылку приглашения. Попробуйте позже.",
        );
      }

      const codeDetails = await database.customerReferralCode.findMany({
        where: { ownerId: user.id },
        orderBy: { slot: "asc" },
        select: {
          id: true,
          slot: true,
          code: true,
          issuedAt: true,
          expiresAt: true,
          claimedAt: true,
          referral: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              rewardedAt: true,
            },
          },
        },
      });
      const legacyReferral = await database.customerReferral.findFirst({
        where: {
          referrerId: user.id,
          promoCodeId: null,
          createdAt: { gte: primaryCode.issuedAt },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, createdAt: true, rewardedAt: true },
      });
      const now = new Date();

      const [totalInvites, pendingCount, rewardedCount, referrals] =
        await Promise.all([
          database.customerReferral.count({ where: { referrerId: user.id } }),
          database.customerReferral.count({
            where: { referrerId: user.id, status: "PENDING" },
          }),
          database.customerReferral.count({
            where: { referrerId: user.id, status: "REWARDED" },
          }),
          database.customerReferral.findMany({
            where: { referrerId: user.id },
            orderBy: { createdAt: "desc" },
            take: 50,
            select: {
              id: true,
              status: true,
              createdAt: true,
              rewardedAt: true,
            },
          }),
        ]);

      response.json({
        referralCode: primaryCode.code,
        codes: codeDetails.map((code) => {
          const referral =
            code.referral ?? (code.slot === 1 ? legacyReferral : null);
          const status = referral
            ? referral.status
            : code.claimedAt
              ? "USED"
              : code.expiresAt <= now
                ? "EXPIRED"
                : "AVAILABLE";
          return {
            id: code.id,
            slot: code.slot,
            code: code.code,
            issuedAt: code.issuedAt,
            expiresAt: code.expiresAt,
            status,
          };
        }),
        codeCount: REFERRAL_CODE_COUNT,
        validityMonths: REFERRAL_CODE_VALIDITY_MONTHS,
        rewardPoints: REFERRAL_REWARD_POINTS,
        totalInvites,
        pendingCount,
        rewardedCount,
        referrals,
      });
    },
  );

  return router;
};
