import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { sendNewsPublicationNotification } from "../notifications/push-notifications.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 5_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_ATTEMPTS_PER_TICK = 20;

type ClaimedNewsPush = {
  readonly id: string;
  readonly article_id: string;
  readonly attempt_count: number;
};

export const newsPushRetryDelayMilliseconds = (attempt: number): number =>
  Math.min(60 * 60 * 1_000, 10_000 * 2 ** Math.max(0, attempt - 1));

const claimDeliveries = async (
  database: DatabaseClient,
): Promise<ClaimedNewsPush[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedNewsPush[]>`
      WITH due AS (
        SELECT id
        FROM news_push_deliveries
        WHERE sent_at IS NULL
          AND next_attempt_at <= CURRENT_TIMESTAMP
          AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
        ORDER BY next_attempt_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${MAX_ATTEMPTS_PER_TICK}
      )
      UPDATE news_push_deliveries AS delivery
      SET locked_until = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
          attempt_count = delivery.attempt_count + 1
      FROM due
      WHERE delivery.id = due.id
      RETURNING delivery.id, delivery.article_id, delivery.attempt_count
    `,
  );

const processDelivery = async (
  database: DatabaseClient,
  delivery: ClaimedNewsPush,
): Promise<void> => {
  const article = await database.newsArticle.findUnique({
    where: { id: delivery.article_id },
    select: {
      id: true,
      title: true,
      isPublished: true,
      startsAt: true,
      endsAt: true,
    },
  });
  const now = new Date();
  if (!article || !article.isPublished) {
    await database.newsPushDelivery.deleteMany({
      where: { id: delivery.id, sentAt: null },
    });
    return;
  }
  if (article.startsAt && article.startsAt > now) {
    await database.newsPushDelivery.updateMany({
      where: { id: delivery.id, sentAt: null },
      data: { nextAttemptAt: article.startsAt, lockedUntil: null },
    });
    return;
  }
  if (article.endsAt && article.endsAt <= now) {
    await database.newsPushDelivery.updateMany({
      where: { id: delivery.id, sentAt: null },
      data: { sentAt: now, lockedUntil: null, lastError: null },
    });
    return;
  }

  const delivered = await sendNewsPublicationNotification(
    database,
    article,
    delivery.id,
  );
  if (delivered) {
    await database.newsPushDelivery.updateMany({
      where: { id: delivery.id, sentAt: null },
      data: { sentAt: new Date(), lockedUntil: null, lastError: null },
    });
    return;
  }

  await database.newsPushDelivery.updateMany({
    where: { id: delivery.id, sentAt: null },
    data: {
      nextAttemptAt: new Date(
        Date.now() + newsPushRetryDelayMilliseconds(delivery.attempt_count),
      ),
      lockedUntil: null,
      lastError: "FCM delivery failed; will retry.",
    },
  });
};

export const runNewsPushWorkerOnce = async (
  database: DatabaseClient,
): Promise<void> => {
  const deliveries = await claimDeliveries(database);
  for (const delivery of deliveries) {
    try {
      await processDelivery(database, delivery);
    } catch {
      await database.newsPushDelivery.updateMany({
        where: { id: delivery.id, sentAt: null },
        data: {
          nextAttemptAt: new Date(
            Date.now() + newsPushRetryDelayMilliseconds(delivery.attempt_count),
          ),
          lockedUntil: null,
          lastError: "News notification processing failed; will retry.",
        },
      });
      logger.warn(
        { code: "NEWS_PUSH_WORK_ITEM_FAILED", deliveryId: delivery.id },
        "news_push_delivery_will_retry",
      );
    }
  }
};

export const startNewsPushWorker = (database: DatabaseClient): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runNewsPushWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "NEWS_PUSH_WORKER_UNAVAILABLE" },
        "news_push_worker_will_retry",
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
