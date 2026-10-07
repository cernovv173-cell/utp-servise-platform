import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { sendCustomerBirthdayNotification } from "./push-notifications.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 60_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_ATTEMPTS_PER_TICK = 50;

type ClaimedBirthdayPush = {
  readonly id: string;
  readonly user_id: string;
  readonly birthday_year: number;
  readonly attempt_count: number;
};

export const birthdayPushRetryDelayMilliseconds = (attempt: number): number =>
  Math.min(60 * 60 * 1_000, 10_000 * 2 ** Math.max(0, attempt - 1));

export const getMoscowBirthdayDate = (now: Date) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: Number(part("year")),
    monthDay: `${part("month")}-${part("day")}`,
  };
};

const enqueueTodaysBirthdays = async (
  database: DatabaseClient,
  birthdayYear: number,
  monthDay: string,
): Promise<void> => {
  await database.$executeRaw`
    INSERT INTO birthday_push_deliveries (id, user_id, birthday_year)
    SELECT gen_random_uuid(), customer.id, ${birthdayYear}
    FROM users AS customer
    WHERE customer.role = 'CUSTOMER'
      AND customer.active = TRUE
      AND customer.birth_date IS NOT NULL
      AND to_char(customer.birth_date, 'MM-DD') = ${monthDay}
      AND EXISTS (
        SELECT 1 FROM push_device_tokens AS device
        WHERE device.user_id = customer.id
      )
    ON CONFLICT (user_id, birthday_year) DO NOTHING
  `;
};

const claimTodaysBirthdays = async (
  database: DatabaseClient,
  birthdayYear: number,
  monthDay: string,
): Promise<ClaimedBirthdayPush[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedBirthdayPush[]>`
      WITH due AS (
        SELECT delivery.id
        FROM birthday_push_deliveries AS delivery
        JOIN users AS customer ON customer.id = delivery.user_id
        WHERE delivery.birthday_year = ${birthdayYear}
          AND delivery.sent_at IS NULL
          AND delivery.next_attempt_at <= CURRENT_TIMESTAMP
          AND (delivery.locked_until IS NULL OR delivery.locked_until < CURRENT_TIMESTAMP)
          AND customer.role = 'CUSTOMER'
          AND customer.active = TRUE
          AND to_char(customer.birth_date, 'MM-DD') = ${monthDay}
        ORDER BY delivery.next_attempt_at ASC, delivery.created_at ASC
        FOR UPDATE OF delivery SKIP LOCKED
        LIMIT ${MAX_ATTEMPTS_PER_TICK}
      )
      UPDATE birthday_push_deliveries AS delivery
      SET locked_until = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
          attempt_count = delivery.attempt_count + 1
      FROM due
      WHERE delivery.id = due.id
      RETURNING delivery.id, delivery.user_id, delivery.birthday_year, delivery.attempt_count
    `,
  );

export const runBirthdayPushWorkerOnce = async (
  database: DatabaseClient,
  now = new Date(),
): Promise<void> => {
  const { year, monthDay } = getMoscowBirthdayDate(now);
  await enqueueTodaysBirthdays(database, year, monthDay);
  const deliveries = await claimTodaysBirthdays(database, year, monthDay);

  for (const delivery of deliveries) {
    try {
      const delivered = await sendCustomerBirthdayNotification(
        database,
        delivery.user_id,
        delivery.birthday_year,
      );
      await database.birthdayPushDelivery.updateMany({
        where: { id: delivery.id, sentAt: null },
        data: delivered
          ? { sentAt: new Date(), lockedUntil: null, lastError: null }
          : {
              nextAttemptAt: new Date(
                Date.now() +
                  birthdayPushRetryDelayMilliseconds(delivery.attempt_count),
              ),
              lockedUntil: null,
              lastError: "FCM delivery failed; will retry.",
            },
      });
    } catch {
      await database.birthdayPushDelivery.updateMany({
        where: { id: delivery.id, sentAt: null },
        data: {
          nextAttemptAt: new Date(
            Date.now() +
              birthdayPushRetryDelayMilliseconds(delivery.attempt_count),
          ),
          lockedUntil: null,
          lastError: "Birthday notification processing failed; will retry.",
        },
      });
      logger.warn(
        { code: "BIRTHDAY_PUSH_WORK_ITEM_FAILED", deliveryId: delivery.id },
        "birthday_notification_will_retry",
      );
    }
  }
};

export const startBirthdayPushWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runBirthdayPushWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "BIRTHDAY_PUSH_WORKER_UNAVAILABLE" },
        "birthday_notification_worker_will_retry",
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
