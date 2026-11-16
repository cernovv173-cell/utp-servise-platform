import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { sendPushNotification } from "../notifications/push-notifications.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 60_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_ATTEMPTS_PER_TICK = 50;
const MAX_DELIVERY_ATTEMPTS = 8;
const MAX_RETRY_DELAY_MILLISECONDS = 6 * 60 * 60 * 1_000;

type ClaimedFollowUp = {
  readonly id: string;
  readonly order_id: string;
  readonly customer_id: string;
  readonly service_number: string;
  readonly scheduled_at: Date;
  readonly attempt_count: number;
  readonly locked_until: Date;
};

export const repairFollowUpRetryDelayMilliseconds = (attempt: number): number =>
  Math.min(
    MAX_RETRY_DELAY_MILLISECONDS,
    60_000 * 2 ** Math.max(0, attempt - 1),
  );

const claimDueFollowUps = async (
  database: DatabaseClient,
): Promise<ClaimedFollowUp[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedFollowUp[]>`
      WITH due AS (
        SELECT follow_up.id
        FROM repair_order_follow_ups AS follow_up
        JOIN repair_orders AS repair_order ON repair_order.id = follow_up.order_id
        JOIN users AS customer ON customer.id = repair_order.customer_id
        WHERE follow_up.status = 'PENDING'
          AND follow_up.scheduled_at <= CURRENT_TIMESTAMP
          AND follow_up.next_attempt_at <= CURRENT_TIMESTAMP
          AND (follow_up.locked_until IS NULL OR follow_up.locked_until < CURRENT_TIMESTAMP)
          AND repair_order.status = 'COMPLETED'
          AND customer.role = 'CUSTOMER'
          AND customer.active = TRUE
        ORDER BY follow_up.next_attempt_at ASC, follow_up.created_at ASC
        FOR UPDATE OF follow_up SKIP LOCKED
        LIMIT ${MAX_ATTEMPTS_PER_TICK}
      )
      UPDATE repair_order_follow_ups AS follow_up
      SET locked_until = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
          attempt_count = follow_up.attempt_count + 1
      FROM due, repair_orders AS repair_order
      WHERE follow_up.id = due.id
        AND repair_order.id = follow_up.order_id
      RETURNING follow_up.id, follow_up.order_id, repair_order.customer_id,
        repair_order.service_number, follow_up.scheduled_at,
        follow_up.attempt_count, follow_up.locked_until
    `,
  );

const updateClaimedFollowUp = (
  database: DatabaseClient,
  followUp: ClaimedFollowUp,
  data: {
    readonly status: "PENDING" | "SENT" | "FAILED";
    readonly nextAttemptAt?: Date;
    readonly sentAt?: Date;
    readonly lastError: string | null;
  },
) =>
  database.repairOrderFollowUp.updateMany({
    where: {
      id: followUp.id,
      status: "PENDING",
      lockedUntil: followUp.locked_until,
    },
    data: { ...data, lockedUntil: null },
  });

export const runRepairFollowUpPushWorkerOnce = async (
  database: DatabaseClient,
  now = new Date(),
  sendNotification: typeof sendPushNotification = sendPushNotification,
): Promise<void> => {
  const followUps = await claimDueFollowUps(database);
  for (const followUp of followUps) {
    try {
      const delivered = await sendNotification(
        database,
        [followUp.customer_id],
        {
          title: "Как прошёл ремонт?",
          body: `Проверьте, пожалуйста, всё ли работает после ремонта по заявке ${followUp.service_number}.`,
          data: {
            type: "repair_follow_up",
            orderId: followUp.order_id,
            followUpId: followUp.id,
          },
          androidTag: `repair-follow-up-${followUp.id}`,
        },
      );
      if (delivered) {
        await updateClaimedFollowUp(database, followUp, {
          status: "SENT",
          sentAt: now,
          lastError: null,
        });
        continue;
      }

      const exhausted = followUp.attempt_count >= MAX_DELIVERY_ATTEMPTS;
      await updateClaimedFollowUp(database, followUp, {
        status: exhausted ? "FAILED" : "PENDING",
        ...(exhausted
          ? {}
          : {
              nextAttemptAt: new Date(
                now.getTime() +
                  repairFollowUpRetryDelayMilliseconds(followUp.attempt_count),
              ),
            }),
        lastError: "Push delivery failed; will retry when attempts remain.",
      });
    } catch {
      const exhausted = followUp.attempt_count >= MAX_DELIVERY_ATTEMPTS;
      await updateClaimedFollowUp(database, followUp, {
        status: exhausted ? "FAILED" : "PENDING",
        ...(exhausted
          ? {}
          : {
              nextAttemptAt: new Date(
                now.getTime() +
                  repairFollowUpRetryDelayMilliseconds(followUp.attempt_count),
              ),
            }),
        lastError:
          "Repair follow-up processing failed; will retry when attempts remain.",
      });
      logger.warn(
        { code: "REPAIR_FOLLOW_UP_PUSH_FAILED", followUpId: followUp.id },
        "repair_follow_up_push_will_retry",
      );
    }
  }
};

export const startRepairFollowUpPushWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runRepairFollowUpPushWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "REPAIR_FOLLOW_UP_WORKER_UNAVAILABLE" },
        "repair_follow_up_worker_will_retry",
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
