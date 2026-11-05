import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import { productAnalyticsDay } from "./product-analytics.js";

const querySchema = z.object({
  days: z.coerce.number().int().min(7).max(90).default(30),
});
const metricNames = ["LOGIN", "REGISTRATION", "APP_DOWNLOAD"] as const;
const channelNames = ["WEB", "ANDROID", "MAX", "OTHER"] as const;

type MetricName = (typeof metricNames)[number];
type ChannelName = (typeof channelNames)[number];
type Counts = Record<MetricName, number>;

const emptyCounts = (): Counts => ({
  LOGIN: 0,
  REGISTRATION: 0,
  APP_DOWNLOAD: 0,
});
const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

export const createProductAnalyticsRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/admin/analytics",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ query: querySchema }),
    async (_request, response) => {
      const {
        query: { days },
      } = response.locals.input as { query: { days: number } };
      const today = productAnalyticsDay();
      const from = new Date(today);
      from.setUTCDate(from.getUTCDate() - days + 1);

      const rows = await database.productAnalyticsDailyMetric.findMany({
        where: { day: { gte: from, lte: today } },
        orderBy: { day: "asc" },
      });
      const channels = Object.fromEntries(
        channelNames.map((channel) => [channel, emptyCounts()]),
      ) as Record<ChannelName, Counts>;
      const byDay = new Map<string, Counts>();

      for (const row of rows) {
        const day = dateKey(row.day);
        const dayCounts = byDay.get(day) ?? emptyCounts();
        dayCounts[row.metric] += row.count;
        byDay.set(day, dayCounts);
        channels[row.channel][row.metric] += row.count;
      }

      const daily = Array.from({ length: days }, (_, index) => {
        const day = new Date(from);
        day.setUTCDate(from.getUTCDate() + index);
        const key = dateKey(day);
        return { day: key, ...(byDay.get(key) ?? emptyCounts()) };
      });
      const totals = channelNames.reduce((result, channel) => {
        for (const metric of metricNames)
          result[metric] += channels[channel][metric];
        return result;
      }, emptyCounts());

      response.json({
        range: { days, from: dateKey(from), to: dateKey(today) },
        totals,
        channels,
        daily,
      });
    },
  );

  return router;
};
