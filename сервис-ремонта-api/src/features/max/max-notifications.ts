import type {
  MaxNotificationType,
  Prisma,
} from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { MaxApiError, sendMaxMessage } from "./max-bot.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 5_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_ATTEMPTS_PER_TICK = 20;
const MAX_DELIVERY_ATTEMPTS = 10;
const MIN_MESSAGE_INTERVAL_MILLISECONDS = 500;

const notificationTitles: Record<MaxNotificationType, string> = {
  DEVICE_ACCEPTED: "Устройство принято",
  DIAGNOSIS_COMPLETED: "Диагностика завершена",
  TECHNICIAN_REPAIR_COMPLETED: "Работы завершены",
  REPAIR_COMPLETED: "Ремонт завершён",
  READY_FOR_PICKUP: "Готово к выдаче",
};

const notificationDetails: Partial<Record<MaxNotificationType, string>> = {
  TECHNICIAN_REPAIR_COMPLETED:
    "Администратор проверит результат и сообщит, когда можно забрать устройство.",
};

const deviceLabels: Record<string, string> = {
  COMPUTER: "Компьютер",
  LAPTOP: "Ноутбук",
  MONOBLOCK: "Моноблок",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

export const formatMaxRepairNotification = (input: {
  readonly type: MaxNotificationType;
  readonly serviceNumber: string;
  readonly deviceType: string;
}): string =>
  [
    notificationTitles[input.type],
    `Заявка: ${input.serviceNumber}`,
    `Устройство: ${deviceLabels[input.deviceType] ?? "Техника"}`,
    notificationDetails[input.type],
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");

export const maxRetryDelayMilliseconds = (attempt: number): number =>
  Math.min(6 * 60 * 60 * 1_000, 10_000 * 2 ** Math.max(0, attempt - 1));

export const scheduleMaxRepairNotification = (
  transaction: Prisma.TransactionClient,
  input: {
    readonly orderId: string;
    readonly userId: string;
    readonly type: MaxNotificationType;
  },
): Promise<unknown> =>
  transaction.maxNotificationDelivery.upsert({
    where: { orderId_type: { orderId: input.orderId, type: input.type } },
    create: input,
    update: {},
  });

type ClaimedMaxDelivery = {
  readonly id: string;
  readonly attempt_count: number;
};

const claimDeliveries = async (
  database: DatabaseClient,
): Promise<ClaimedMaxDelivery[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedMaxDelivery[]>`
        WITH due AS (
          SELECT "id"
          FROM "max_notification_deliveries"
          WHERE "status" = 'PENDING'
            AND "next_attempt_at" <= CURRENT_TIMESTAMP
            AND ("locked_until" IS NULL OR "locked_until" < CURRENT_TIMESTAMP)
          ORDER BY "next_attempt_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${MAX_ATTEMPTS_PER_TICK}
        )
        UPDATE "max_notification_deliveries" AS delivery
        SET "locked_until" = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
            "attempt_count" = delivery."attempt_count" + 1
        FROM due
        WHERE delivery."id" = due."id"
        RETURNING delivery."id", delivery."attempt_count"
      `,
  );

const waitForMessageInterval = async (): Promise<void> => {
  const now = Date.now();
  const delay = Math.max(
    0,
    lastMessageAt + MIN_MESSAGE_INTERVAL_MILLISECONDS - now,
  );
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
  lastMessageAt = Date.now();
};

let lastMessageAt = 0;

const processDelivery = async (
  database: DatabaseClient,
  delivery: ClaimedMaxDelivery,
): Promise<void> => {
  const row = await database.maxNotificationDelivery.findUnique({
    where: { id: delivery.id },
    include: {
      user: { select: { maxUserId: true } },
      order: { select: { serviceNumber: true, deviceType: true } },
    },
  });
  if (!row || row.status !== "PENDING") return;

  if (!row.user.maxUserId) {
    await database.maxNotificationDelivery.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: {
        status: "SKIPPED",
        lockedUntil: null,
        lastError: "MAX is not connected.",
      },
    });
    return;
  }

  try {
    await waitForMessageInterval();
    await sendMaxMessage(
      row.user.maxUserId,
      formatMaxRepairNotification({
        type: row.type,
        serviceNumber: row.order.serviceNumber,
        deviceType: row.order.deviceType,
      }),
    );
    await database.maxNotificationDelivery.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lockedUntil: null,
        lastError: null,
      },
    });
  } catch (error) {
    const permanentFailure =
      error instanceof MaxApiError &&
      error.errorCode !== undefined &&
      error.errorCode >= 400 &&
      error.errorCode < 500 &&
      error.errorCode !== 429;
    const terminalFailure =
      permanentFailure || delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS;
    const retryAfter =
      error instanceof MaxApiError ? error.retryAfterSeconds : undefined;
    await database.maxNotificationDelivery.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: {
        status: terminalFailure ? "FAILED" : "PENDING",
        nextAttemptAt: new Date(
          Date.now() +
            (retryAfter
              ? retryAfter * 1_000
              : maxRetryDelayMilliseconds(delivery.attempt_count)),
        ),
        lockedUntil: null,
        lastError: permanentFailure
          ? "MAX rejected the delivery."
          : "MAX delivery failed; will retry.",
      },
    });
    logger.warn(
      { code: "MAX_NOTIFICATION_DELIVERY_FAILED", deliveryId: row.id },
      terminalFailure
        ? "max_notification_delivery_stopped"
        : "max_notification_delivery_will_retry",
    );
  }
};

export const runMaxNotificationWorkerOnce = async (
  database: DatabaseClient,
): Promise<void> => {
  const deliveries = await claimDeliveries(database);
  for (const delivery of deliveries) {
    try {
      await processDelivery(database, delivery);
    } catch {
      await database.maxNotificationDelivery.updateMany({
        where: { id: delivery.id, status: "PENDING" },
        data: {
          nextAttemptAt: new Date(
            Date.now() + maxRetryDelayMilliseconds(delivery.attempt_count),
          ),
          lockedUntil: null,
          lastError: "MAX notification processing failed; will retry.",
        },
      });
      logger.warn(
        { code: "MAX_NOTIFICATION_WORK_ITEM_FAILED", deliveryId: delivery.id },
        "max_notification_delivery_will_retry",
      );
    }
  }
};

export const startMaxNotificationWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runMaxNotificationWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "MAX_NOTIFICATION_WORKER_UNAVAILABLE" },
        "max_notification_worker_will_retry",
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
