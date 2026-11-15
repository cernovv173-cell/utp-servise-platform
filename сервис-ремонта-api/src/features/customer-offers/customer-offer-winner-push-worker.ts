import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { customerOfferPushRetryDelayMilliseconds } from "./customer-offer-push-worker.js";
import { getCustomerOfferReward } from "./customer-offer-rewards.js";
import { sendCustomerOfferWinnerNotification } from "./customer-offer-winner-push-notifications.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 5_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_DELIVERIES_PER_TICK = 20;

type ClaimedCustomerOfferWinnerPush = {
  readonly id: string;
  readonly offer_id: string;
  readonly customer_id: string;
  readonly attempt_count: number;
};

const claimDeliveries = async (
  database: DatabaseClient,
): Promise<ClaimedCustomerOfferWinnerPush[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedCustomerOfferWinnerPush[]>`
      WITH due AS (
        SELECT id
        FROM customer_offer_winner_push_deliveries
        WHERE sent_at IS NULL
          AND next_attempt_at <= CURRENT_TIMESTAMP
          AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
        ORDER BY next_attempt_at ASC, created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT ${MAX_DELIVERIES_PER_TICK}
      )
      UPDATE customer_offer_winner_push_deliveries AS delivery
      SET locked_until = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
          attempt_count = delivery.attempt_count + 1
      FROM due
      WHERE delivery.id = due.id
      RETURNING delivery.id, delivery.offer_id, delivery.customer_id, delivery.attempt_count
    `,
  );

const markSent = async (
  database: DatabaseClient,
  deliveryId: string,
): Promise<void> => {
  await database.customerOfferWinnerPushDelivery.updateMany({
    where: { id: deliveryId, sentAt: null },
    data: { sentAt: new Date(), lockedUntil: null, lastError: null },
  });
};

const discardDelivery = async (
  database: DatabaseClient,
  deliveryId: string,
): Promise<void> => {
  await database.customerOfferWinnerPushDelivery.deleteMany({
    where: { id: deliveryId, sentAt: null },
  });
};

const deferDelivery = async (
  database: DatabaseClient,
  delivery: ClaimedCustomerOfferWinnerPush,
  message: string,
): Promise<void> => {
  await database.customerOfferWinnerPushDelivery.updateMany({
    where: { id: delivery.id, sentAt: null },
    data: {
      nextAttemptAt: new Date(
        Date.now() +
          customerOfferPushRetryDelayMilliseconds(delivery.attempt_count),
      ),
      lockedUntil: null,
      lastError: message,
    },
  });
};

const processDelivery = async (
  database: DatabaseClient,
  delivery: ClaimedCustomerOfferWinnerPush,
): Promise<void> => {
  const offer = await database.customerOffer.findUnique({
    where: { id: delivery.offer_id },
    select: {
      id: true,
      type: true,
      title: true,
      isPublished: true,
      resultsPublishedAt: true,
      firstPlacePrize: true,
      firstPlacePoints: true,
      secondPlacePrize: true,
      secondPlacePoints: true,
      thirdPlacePrize: true,
      thirdPlacePoints: true,
    },
  });

  if (
    !offer ||
    !offer.isPublished ||
    (offer.type !== "GIVEAWAY" && offer.type !== "QUIZ") ||
    !offer.resultsPublishedAt
  ) {
    await discardDelivery(database, delivery.id);
    return;
  }

  const participation = await database.customerOfferParticipation.findUnique({
    where: {
      offerId_customerId: {
        offerId: delivery.offer_id,
        customerId: delivery.customer_id,
      },
    },
    select: { place: true, customer: { select: { active: true } } },
  });
  if (!participation?.place || !participation.customer.active) {
    await markSent(database, delivery.id);
    return;
  }

  const reward = getCustomerOfferReward(offer, participation.place);
  if (!reward) {
    await markSent(database, delivery.id);
    return;
  }

  const delivered = await sendCustomerOfferWinnerNotification(
    database,
    offer,
    delivery.customer_id,
    reward,
    delivery.id,
  );
  if (delivered) {
    await markSent(database, delivery.id);
    return;
  }

  await deferDelivery(
    database,
    delivery,
    "No registered device or FCM delivery failed; will retry.",
  );
};

export const runCustomerOfferWinnerPushWorkerOnce = async (
  database: DatabaseClient,
): Promise<void> => {
  const deliveries = await claimDeliveries(database);
  for (const delivery of deliveries) {
    try {
      await processDelivery(database, delivery);
    } catch {
      await deferDelivery(
        database,
        delivery,
        "Customer offer winner notification processing failed; will retry.",
      );
      logger.warn(
        {
          code: "CUSTOMER_OFFER_WINNER_PUSH_WORK_ITEM_FAILED",
          deliveryId: delivery.id,
        },
        "customer_offer_winner_push_delivery_will_retry",
      );
    }
  }
};

export const startCustomerOfferWinnerPushWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runCustomerOfferWinnerPushWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "CUSTOMER_OFFER_WINNER_PUSH_WORKER_UNAVAILABLE" },
        "customer_offer_winner_push_worker_will_retry",
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
