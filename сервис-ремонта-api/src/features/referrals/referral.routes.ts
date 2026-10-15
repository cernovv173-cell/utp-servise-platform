import { Router } from "express";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { isUniqueViolation } from "../auth/session.js";
import { generateReferralCode } from "./referral-code.js";

export const createReferralRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/referrals/me",
    requireAuth,
    requireRoles("CUSTOMER"),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      let referralCode = (
        await database.user.findUnique({
          where: { id: user.id },
          select: { referralCode: true },
        })
      )?.referralCode;

      for (let attempt = 0; !referralCode && attempt < 5; attempt += 1) {
        const candidate = generateReferralCode();
        try {
          await database.user.updateMany({
            where: { id: user.id, referralCode: null },
            data: { referralCode: candidate },
          });
        } catch (error) {
          if (!isUniqueViolation(error)) throw error;
        }
        referralCode = (
          await database.user.findUnique({
            where: { id: user.id },
            select: { referralCode: true },
          })
        )?.referralCode;
      }

      if (!referralCode) {
        throw new HttpError(
          503,
          "REFERRAL_CODE_UNAVAILABLE",
          "Не удалось подготовить ссылку приглашения. Попробуйте позже.",
        );
      }

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
        referralCode,
        totalInvites,
        pendingCount,
        rewardedCount,
        referrals,
      });
    },
  );

  return router;
};
