import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { getMoscowBirthdayDate } from "./birthday-time.js";
import { sendCustomerMaintenanceReminder } from "./push-notifications.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 60_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_ATTEMPTS_PER_TICK = 50;

type ClaimedReminder = {
  readonly id: string;
  readonly device_id: string;
  readonly customer_id: string;
  readonly scheduled_for: Date;
  readonly attempt_count: number;
  readonly nickname: string | null;
  readonly device_type: string;
  readonly brand: string | null;
  readonly model: string | null;
};

const retryDelayMilliseconds = (attempt: number): number =>
  Math.min(60 * 60 * 1_000, 10_000 * 2 ** Math.max(0, attempt - 1));

const enqueueDueReminders = async (
  database: DatabaseClient,
  today: string,
): Promise<void> => {
  await database.$executeRaw`
    INSERT INTO device_maintenance_reminder_deliveries
      (id, device_id, scheduled_for)
    SELECT gen_random_uuid(), device.id, device.next_maintenance_at
    FROM customer_devices AS device
    JOIN users AS customer ON customer.id = device.customer_id
    WHERE device.next_maintenance_at <= ${today}::date
      AND customer.role = 'CUSTOMER'
      AND customer.active = TRUE
      AND EXISTS (
        SELECT 1 FROM push_device_tokens AS push_device
        WHERE push_device.user_id = customer.id
      )
    ON CONFLICT (device_id, scheduled_for) DO NOTHING
  `;
};

const claimDueReminders = async (
  database: DatabaseClient,
): Promise<ClaimedReminder[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedReminder[]>`
      WITH due AS (
        SELECT delivery.id
        FROM device_maintenance_reminder_deliveries AS delivery
        JOIN customer_devices AS device ON device.id = delivery.device_id
        JOIN users AS customer ON customer.id = device.customer_id
        WHERE delivery.sent_at IS NULL
          AND delivery.next_attempt_at <= CURRENT_TIMESTAMP
          AND (delivery.locked_until IS NULL OR delivery.locked_until < CURRENT_TIMESTAMP)
          AND device.next_maintenance_at = delivery.scheduled_for
          AND customer.role = 'CUSTOMER'
          AND customer.active = TRUE
        ORDER BY delivery.next_attempt_at ASC, delivery.created_at ASC
        FOR UPDATE OF delivery SKIP LOCKED
        LIMIT ${MAX_ATTEMPTS_PER_TICK}
      )
      UPDATE device_maintenance_reminder_deliveries AS delivery
      SET locked_until = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
          attempt_count = delivery.attempt_count + 1
      FROM due, customer_devices AS device
      WHERE delivery.id = due.id AND device.id = delivery.device_id
      RETURNING delivery.id, delivery.device_id, device.customer_id,
        delivery.scheduled_for, delivery.attempt_count, device.nickname,
        device.device_type, device.brand, device.model
    `,
  );

export const runMaintenanceReminderWorkerOnce = async (
  database: DatabaseClient,
  now = new Date(),
): Promise<void> => {
  const { year, monthDay } = getMoscowBirthdayDate(now);
  const today = `${year}-${monthDay}`;
  await enqueueDueReminders(database, today);
  const reminders = await claimDueReminders(database);

  for (const reminder of reminders) {
    const label =
      reminder.nickname ||
      [reminder.brand, reminder.model].filter(Boolean).join(" ") ||
      reminder.device_type;
    const scheduledFor = reminder.scheduled_for.toISOString().slice(0, 10);
    try {
      const delivered = await sendCustomerMaintenanceReminder(
        database,
        reminder.customer_id,
        reminder.device_id,
        label,
        scheduledFor,
      );
      await database.deviceMaintenanceReminderDelivery.updateMany({
        where: { id: reminder.id, sentAt: null },
        data: delivered
          ? { sentAt: new Date(), lockedUntil: null, lastError: null }
          : {
              nextAttemptAt: new Date(
                Date.now() + retryDelayMilliseconds(reminder.attempt_count),
              ),
              lockedUntil: null,
              lastError: "FCM delivery failed; will retry.",
            },
      });
    } catch {
      await database.deviceMaintenanceReminderDelivery.updateMany({
        where: { id: reminder.id, sentAt: null },
        data: {
          nextAttemptAt: new Date(
            Date.now() + retryDelayMilliseconds(reminder.attempt_count),
          ),
          lockedUntil: null,
          lastError: "Maintenance notification processing failed; will retry.",
        },
      });
      logger.warn(
        { code: "MAINTENANCE_REMINDER_FAILED", deliveryId: reminder.id },
        "maintenance_reminder_will_retry",
      );
    }
  }
};

export const startMaintenanceReminderWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runMaintenanceReminderWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "MAINTENANCE_REMINDER_WORKER_UNAVAILABLE" },
        "maintenance_reminder_worker_will_retry",
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
