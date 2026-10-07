import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import { TECHNICIAN_SALARY_RATE_PERCENT } from "./salary-calculation.js";
import {
  type SalaryPeriodName,
  getSalaryPeriodRanges,
} from "./salary-periods.js";

const validTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
};

const salaryQuery = z
  .object({
    timeZone: z
      .string()
      .trim()
      .min(1)
      .max(64)
      .refine(validTimeZone)
      .default("UTC"),
  })
  .strict();

const periodAmount = (
  entries: readonly { earnedAt: Date; salaryRub: number }[],
  range: { startsAt: Date; endsAt: Date },
): number =>
  entries.reduce(
    (total, entry) =>
      entry.earnedAt >= range.startsAt && entry.earnedAt < range.endsAt
        ? total + entry.salaryRub
        : total,
    0,
  );

export const createSalaryRouter = (database: DatabaseClient): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/salary",
    requireAuth,
    requireRoles("TECHNICIAN", "ADMIN"),
    validateRequest({ query: salaryQuery }),
    async (_request, response) => {
      const user = getAuthenticatedUser(response);
      const query = (
        response.locals.input as { readonly query: z.infer<typeof salaryQuery> }
      ).query;
      const now = new Date();
      const ranges = getSalaryPeriodRanges(now, query.timeZone);
      const earliestPeriod = new Date(
        Math.min(
          ranges.day.startsAt.getTime(),
          ranges.week.startsAt.getTime(),
          ranges.month.startsAt.getTime(),
        ),
      );

      const technicians =
        user.role === "ADMIN"
          ? await database.user.findMany({
              where: { role: "TECHNICIAN" },
              select: { id: true, displayName: true, salaryRatePercent: true },
              orderBy: { displayName: "asc" },
            })
          : [
              {
                id: user.id,
                displayName: user.displayName,
                salaryRatePercent:
                  user.salaryRatePercent ?? TECHNICIAN_SALARY_RATE_PERCENT,
              },
            ];
      const entries = await database.technicianSalaryEntry.findMany({
        where: {
          technicianId: { in: technicians.map(({ id }) => id) },
          earnedAt: { gte: earliestPeriod, lte: now },
        },
        select: { technicianId: true, earnedAt: true, salaryRub: true },
      });

      const byTechnician = technicians.map((technician) => {
        const technicianEntries = entries.filter(
          (entry) => entry.technicianId === technician.id,
        );
        const amounts = Object.fromEntries(
          (Object.keys(ranges) as SalaryPeriodName[]).map((period) => [
            period,
            periodAmount(technicianEntries, ranges[period]),
          ]),
        ) as Record<SalaryPeriodName, number>;
        return { ...technician, amounts };
      });

      const totals = (Object.keys(ranges) as SalaryPeriodName[]).reduce(
        (summary, period) => {
          summary[period] = byTechnician.reduce(
            (sum, technician) => sum + technician.amounts[period],
            0,
          );
          return summary;
        },
        { day: 0, week: 0, month: 0 } as Record<SalaryPeriodName, number>,
      );

      response.json({
        ratePercent:
          user.role === "TECHNICIAN"
            ? (user.salaryRatePercent ?? TECHNICIAN_SALARY_RATE_PERCENT)
            : null,
        timeZone: query.timeZone,
        generatedAt: now,
        ranges: Object.fromEntries(
          (Object.keys(ranges) as SalaryPeriodName[]).map((period) => [
            period,
            {
              startsAt: ranges[period].startsAt,
              endsAt: ranges[period].endsAt,
            },
          ]),
        ),
        totals,
        technicians: byTechnician,
      });
    },
  );

  return router;
};
