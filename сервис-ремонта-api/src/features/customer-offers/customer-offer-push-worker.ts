import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { sendCustomerOfferPublicationNotification } from "../notifications/push-notifications.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 5_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_ATTEMPTS_PER_TICK = 20;
const isSupportedOfferType = (
  type: string,
): type is "PROMOTION" | "GIVEAWAY" =>
  type === "PROMOTION" || type === "GIVEAWAY";

type ClaimedCustomerOfferPush = {
  readonly id: string;
  readonly offer_id: string;
  readonly attempt_count: number;
};

export const customerOfferPushRetryDelayMilliseconds = (
  attempt: number,
): number => Math.min(60 * 60 * 1_000, 10_000 * 2 ** Math.max(0, attempt - 1));

const claimDeliveries = async (
  database: DatabaseClient,
): Promise<ClaimedCustomerOfferPush[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedCustomerOfferPush[]>`
      WITH due AS (
        SELECT id
        FROM customer_offer_push_deliveries
        WHERE sent_at IS NULL
          AND next_attempt_at <= CURRENT_TIMESTAMP
          AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
        ORDER BY next_attempt_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${MAX_ATTEMPTS_PER_TICK}
      )
      UPDATE customer_offer_push_deliveries AS delivery
      SET locked_until = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
          attempt_count = delivery.attempt_count + 1
      FROM due
      WHERE delivery.id = due.id
      RETURNING delivery.id, delivery.offer_id, delivery.attempt_count
    `,
  );

const processDelivery = async (
  database: DatabaseClient,
  delivery: ClaimedCustomerOfferPush,
): Promise<void> => {
  const offer = await database.customerOffer.findUnique({
    where: { id: delivery.offer_id },
    select: {
      id: true,
      type: true,
      title: true,
      isPublished: true,
      endsAt: true,
    },
  });
  const now = new Date();

  if (!offer || !offer.isPublished) {
    await database.customerOfferPushDelivery.deleteMany({
      where: { id: delivery.id, sentAt: null },
    });
    return;
  }
  if (!isSupportedOfferType(offer.type)) {
    await database.customerOfferPushDelivery.deleteMany({
      where: { id: delivery.id, sentAt: null },
    });
    return;
  }
  if (offer.endsAt <= now) {
    await database.customerOfferPushDelivery.updateMany({
      where: { id: delivery.id, sentAt: null },
      data: { sentAt: now, lockedUntil: null, lastError: null },
    });
    return;
  }

  const delivered = await sendCustomerOfferPublicationNotification(
    database,
    {
      ...offer,
      type: offer.type as "PROMOTION" | "GIVEAWAY",
    },
    delivery.id,
  );
  if (delivered) {
    await database.customerOfferPushDelivery.updateMany({
      where: { id: delivery.id, sentAt: null },
      data: { sentAt: new Date(), lockedUntil: null, lastError: null },
    });
    return;
  }

  await database.customerOfferPushDelivery.updateMany({
    where: { id: delivery.id, sentAt: null },
    data: {
      nextAttemptAt: new Date(
        Date.now() +
          customerOfferPushRetryDelayMilliseconds(delivery.attempt_count),
      ),
      lockedUntil: null,
      lastError: "FCM delivery failed; will retry.",
    },
  });
};

export const runCustomerOfferPushWorkerOnce = async (
  database: DatabaseClient,
): Promise<void> => {
  const deliveries = await claimDeliveries(database);
  for (const delivery of deliveries) {
    try {
      await processDelivery(database, delivery);
    } catch {
      await database.customerOfferPushDelivery.updateMany({
        where: { id: delivery.id, sentAt: null },
        data: {
          nextAttemptAt: new Date(
            Date.now() +
              customerOfferPushRetryDelayMilliseconds(delivery.attempt_count),
          ),
          lockedUntil: null,
          lastError:
            "Customer offer notification processing failed; will retry.",
        },
      });
      logger.warn(
        {
          code: "CUSTOMER_OFFER_PUSH_WORK_ITEM_FAILED",
          deliveryId: delivery.id,
        },
        "customer_offer_push_delivery_will_retry",
      );
    }
  }
};

export const startCustomerOfferPushWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runCustomerOfferPushWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "CUSTOMER_OFFER_PUSH_WORKER_UNAVAILABLE" },
        "customer_offer_push_worker_will_retry",
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
