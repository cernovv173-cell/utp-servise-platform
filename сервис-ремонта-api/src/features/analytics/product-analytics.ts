import type { Request } from "express";

import type {
  ProductAnalyticsChannel,
  ProductAnalyticsMetric,
} from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";

const logger = createLogger();

const moscowDate = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export const productAnalyticsChannel = (
  request: Pick<Request, "header">,
): ProductAnalyticsChannel => {
  if (request.header("origin") || request.header("referer")) return "WEB";
  if (/android/iu.test(request.header("user-agent") ?? "")) return "ANDROID";
  return "OTHER";
};

export const productAnalyticsDay = (now: Date = new Date()): Date =>
  new Date(`${moscowDate.format(now)}T00:00:00.000Z`);

export const recordProductAnalytics = async (
  database: DatabaseClient,
  metric: ProductAnalyticsMetric,
  channel: ProductAnalyticsChannel,
  now: Date = new Date(),
): Promise<void> => {
  const day = productAnalyticsDay(now);
  const dailyMetrics = database.productAnalyticsDailyMetric;
  if (!dailyMetrics) return;
  try {
    await dailyMetrics.upsert({
      where: { day_metric_channel: { day, metric, channel } },
      create: { day, metric, channel, count: 1 },
      update: { count: { increment: 1 } },
    });
  } catch {
    // Analytics is intentionally non-blocking for sign-in, registration, and download flows.
    logger.warn({ metric, channel }, "product_analytics_record_failed");
  }
};
