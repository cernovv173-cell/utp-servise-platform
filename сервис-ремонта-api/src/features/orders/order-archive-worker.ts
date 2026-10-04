import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { getSalaryPeriodRanges } from "../salary/salary-periods.js";

const logger = createLogger();
const ARCHIVE_TIME_ZONE = "Europe/Moscow";
const WORKER_INTERVAL_MILLISECONDS = 60_000;

export const archivePreviousDayOrders = async (
  database: DatabaseClient,
  now = new Date(),
): Promise<number> => {
  const { startsAt } = getSalaryPeriodRanges(now, ARCHIVE_TIME_ZONE).day;
  const result = await database.repairOrder.updateMany({
    where: {
      archivedAt: null,
      createdAt: { lt: startsAt },
    },
    data: { archivedAt: now },
  });
  return result.count;
};

export const startOrderArchiveWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      const archivedCount = await archivePreviousDayOrders(database);
      if (archivedCount > 0) {
        logger.info(
          { archivedCount, timeZone: ARCHIVE_TIME_ZONE },
          "previous_day_orders_archived",
        );
      }
    } catch {
      logger.warn(
        { code: "ORDER_ARCHIVE_WORKER_UNAVAILABLE" },
        "order_archive_will_retry",
      );
    } finally {
      running = false;
    }
  };
  const interval = setInterval(() => void tick(), WORKER_INTERVAL_MILLISECONDS);
  interval.unref();
  void tick();
  return () => clearInterval(interval);
};
