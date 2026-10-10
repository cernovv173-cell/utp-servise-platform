import type {
  Prisma,
  TelegramNotificationType,
} from "../../generated/prisma/client.js";
import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import { TelegramApiError, sendTelegramMessage } from "./telegram-bot.js";

const logger = createLogger();
const WORKER_INTERVAL_MILLISECONDS = 5_000;
const DELIVERY_LOCK_MILLISECONDS = 90_000;
const MAX_ATTEMPTS_PER_TICK = 20;
const MAX_DELIVERY_ATTEMPTS = 10;

const notificationTitles: Record<TelegramNotificationType, string> = {
  DEVICE_ACCEPTED: "Устройство принято",
  DIAGNOSIS_COMPLETED: "Диагностика завершена",
  READY_FOR_PICKUP: "Готово к выдаче",
};

const deviceLabels: Record<string, string> = {
  COMPUTER: "Компьютер",
  LAPTOP: "Ноутбук",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

export const formatTelegramRepairNotification = (input: {
  readonly type: TelegramNotificationType;
  readonly serviceNumber: string;
  readonly deviceType: string;
}): string =>
  `${notificationTitles[input.type]}\nЗаявка: ${input.serviceNumber}\nУстройство: ${deviceLabels[input.deviceType] ?? "Техника"}`;

export const telegramRetryDelayMilliseconds = (attempt: number): number =>
  Math.min(6 * 60 * 60 * 1_000, 10_000 * 2 ** Math.max(0, attempt - 1));

export const scheduleTelegramRepairNotification = (
  transaction: Prisma.TransactionClient,
  input: {
    readonly orderId: string;
    readonly userId: string;
    readonly type: TelegramNotificationType;
  },
): Promise<unknown> =>
  transaction.telegramNotificationDelivery.upsert({
    where: { orderId_type: { orderId: input.orderId, type: input.type } },
    create: input,
    update: {},
  });

type ClaimedTelegramDelivery = {
  readonly id: string;
  readonly attempt_count: number;
};

const claimDeliveries = async (
  database: DatabaseClient,
): Promise<ClaimedTelegramDelivery[]> =>
  database.$transaction(
    (transaction) =>
      transaction.$queryRaw<ClaimedTelegramDelivery[]>`
        WITH due AS (
          SELECT "id"
          FROM "telegram_notification_deliveries"
          WHERE "status" = 'PENDING'
            AND "next_attempt_at" <= CURRENT_TIMESTAMP
            AND ("locked_until" IS NULL OR "locked_until" < CURRENT_TIMESTAMP)
          ORDER BY "next_attempt_at" ASC, "created_at" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT ${MAX_ATTEMPTS_PER_TICK}
        )
        UPDATE "telegram_notification_deliveries" AS delivery
        SET "locked_until" = CURRENT_TIMESTAMP + (${DELIVERY_LOCK_MILLISECONDS} * INTERVAL '1 millisecond'),
            "attempt_count" = delivery."attempt_count" + 1
        FROM due
        WHERE delivery."id" = due."id"
        RETURNING delivery."id", delivery."attempt_count"
      `,
  );

const processDelivery = async (
  database: DatabaseClient,
  delivery: ClaimedTelegramDelivery,
): Promise<void> => {
  const row = await database.telegramNotificationDelivery.findUnique({
    where: { id: delivery.id },
    include: {
      user: { select: { telegramChatId: true } },
      order: { select: { serviceNumber: true, deviceType: true } },
    },
  });
  if (!row || row.status !== "PENDING") return;

  if (!row.user.telegramChatId) {
    await database.telegramNotificationDelivery.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: {
        status: "SKIPPED",
        lockedUntil: null,
        lastError: "Telegram is not connected.",
      },
    });
    return;
  }

  try {
    await sendTelegramMessage(
      row.user.telegramChatId,
      formatTelegramRepairNotification({
        type: row.type,
        serviceNumber: row.order.serviceNumber,
        deviceType: row.order.deviceType,
      }),
    );
    await database.telegramNotificationDelivery.updateMany({
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
      error instanceof TelegramApiError &&
      error.errorCode !== undefined &&
      error.errorCode >= 400 &&
      error.errorCode < 500 &&
      error.errorCode !== 429;
    const terminalFailure =
      permanentFailure || delivery.attempt_count >= MAX_DELIVERY_ATTEMPTS;
    const retryAfter =
      error instanceof TelegramApiError ? error.retryAfterSeconds : undefined;
    await database.telegramNotificationDelivery.updateMany({
      where: { id: row.id, status: "PENDING" },
      data: {
        status: terminalFailure ? "FAILED" : "PENDING",
        nextAttemptAt: new Date(
          Date.now() +
            (retryAfter
              ? retryAfter * 1_000
              : telegramRetryDelayMilliseconds(delivery.attempt_count)),
        ),
        lockedUntil: null,
        lastError: permanentFailure
          ? "Telegram rejected the delivery."
          : "Telegram delivery failed; will retry.",
      },
    });
    logger.warn(
      { code: "TELEGRAM_NOTIFICATION_DELIVERY_FAILED", deliveryId: row.id },
      terminalFailure
        ? "telegram_notification_delivery_stopped"
        : "telegram_notification_delivery_will_retry",
    );
  }
};

export const runTelegramNotificationWorkerOnce = async (
  database: DatabaseClient,
): Promise<void> => {
  const deliveries = await claimDeliveries(database);
  for (const delivery of deliveries) {
    try {
      await processDelivery(database, delivery);
    } catch {
      await database.telegramNotificationDelivery.updateMany({
        where: { id: delivery.id, status: "PENDING" },
        data: {
          nextAttemptAt: new Date(
            Date.now() + telegramRetryDelayMilliseconds(delivery.attempt_count),
          ),
          lockedUntil: null,
          lastError: "Telegram notification processing failed; will retry.",
        },
      });
      logger.warn(
        {
          code: "TELEGRAM_NOTIFICATION_WORK_ITEM_FAILED",
          deliveryId: delivery.id,
        },
        "telegram_notification_delivery_will_retry",
      );
    }
  }
};

export const startTelegramNotificationWorker = (
  database: DatabaseClient,
): (() => void) => {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runTelegramNotificationWorkerOnce(database);
    } catch {
      logger.warn(
        { code: "TELEGRAM_NOTIFICATION_WORKER_UNAVAILABLE" },
        "telegram_notification_worker_will_retry",
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
