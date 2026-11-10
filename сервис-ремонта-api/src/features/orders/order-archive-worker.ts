import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { getSalaryPeriodRanges } from "../salary/salary-periods.js";

const logger = createLogger();
const ARCHIVE_TIME_ZONE = "Europe/Moscow";
const WORKER_INTERVAL_MILLISECONDS = 60_000;

export const archivePreviousDayClosedOrders = async (
  database: DatabaseClient,
  now = new Date(),
): Promise<number> => {
  const { startsAt } = getSalaryPeriodRanges(now, ARCHIVE_TIME_ZONE).day;
  const result = await database.repairOrder.updateMany({
    where: {
      archivedAt: null,
      status: { in: ["COMPLETED", "CANCELLED"] },
      updatedAt: { lt: startsAt },
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
      const archivedCount = await archivePreviousDayClosedOrders(database);
      if (archivedCount > 0) {
        logger.info(
          { archivedCount, timeZone: ARCHIVE_TIME_ZONE },
          "previous_day_closed_orders_archived",
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
