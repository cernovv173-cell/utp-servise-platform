import { createApp } from "./app.js";
import { ensureInitialAdmin } from "./features/auth/auth.routes.js";
import { startCustomerOfferPushWorker } from "./features/customer-offers/customer-offer-push-worker.js";
import { startCustomerOfferWinnerPushWorker } from "./features/customer-offers/customer-offer-winner-push-worker.js";
import { hasMaxBotToken, hasMaxWebhookSecret } from "./features/max/max-bot.js";
import { startMaxNotificationWorker } from "./features/max/max-notifications.js";
import { setupMaxWebhookIfUnclaimed } from "./features/max/max-webhook-setup.js";
import { startNewsPushWorker } from "./features/news/news-push-worker.js";
import { startBirthdayPushWorker } from "./features/notifications/birthday-push-worker.js";
import { startMaintenanceReminderWorker } from "./features/notifications/maintenance-reminder-worker.js";
import { startOrderArchiveWorker } from "./features/orders/order-archive-worker.js";
import { startRepairFollowUpPushWorker } from "./features/orders/repair-follow-up-push-worker.js";
import { startMonthlySalaryReportWorker } from "./features/salary/monthly-salary-report-worker.js";
import { startTelegramNotificationWorker } from "./features/telegram/telegram-notifications.js";
import { setupTelegramWebhookIfUnclaimed } from "./features/telegram/telegram-webhook-setup.js";
import { readConfig } from "./lib/config.js";
import { createDatabase } from "./lib/database/database.js";
import { runDatabaseMigrations } from "./lib/database/migrations.js";
import { createLogger } from "./lib/logger.js";
import { formatStartupError } from "./lib/startup-error.js";

const host = "0.0.0.0";

const start = async (): Promise<void> => {
  const config = readConfig();
  const logger = createLogger();
  const database = config.databaseUrl
    ? createDatabase(config.databaseUrl)
    : undefined;

  if (database && config.nodeEnv === "production") {
    try {
      await runDatabaseMigrations(database);
    } catch (error) {
      await database.close().catch(() => undefined);
      throw error;
    }
  }

  if (database && config.initialAdminEmail && config.initialAdminPassword) {
    await ensureInitialAdmin(
      database.client,
      config.initialAdminEmail,
      config.initialAdminPassword,
    );
    logger.info("Initial administrator bootstrap checked");
  }

  const app = createApp({ database, logger });
  const stopNewsPushWorker = database
    ? startNewsPushWorker(database.client)
    : () => undefined;
  const stopCustomerOfferPushWorker = database
    ? startCustomerOfferPushWorker(database.client)
    : () => undefined;
  const stopCustomerOfferWinnerPushWorker = database
    ? startCustomerOfferWinnerPushWorker(database.client)
    : () => undefined;
  const stopBirthdayPushWorker =
    database && config.nodeEnv === "production"
      ? startBirthdayPushWorker(database.client)
      : () => undefined;
  const stopMaintenanceReminderWorker =
    database && config.nodeEnv === "production"
      ? startMaintenanceReminderWorker(database.client)
      : () => undefined;
  const stopRepairFollowUpPushWorker =
    database && config.nodeEnv === "production"
      ? startRepairFollowUpPushWorker(database.client)
      : () => undefined;
  const stopOrderArchiveWorker = database
    ? startOrderArchiveWorker(database.client)
    : () => undefined;
  const stopTelegramNotificationWorker =
    database && config.nodeEnv === "production"
      ? startTelegramNotificationWorker(database.client)
      : () => undefined;
  const stopMaxNotificationWorker =
    database && config.nodeEnv === "production"
      ? startMaxNotificationWorker(database.client)
      : () => undefined;
  const stopMonthlySalaryReportWorker =
    database && config.nodeEnv === "production"
      ? startMonthlySalaryReportWorker(database.client)
      : () => undefined;
  const server = app.listen(config.port, host, () => {
    logger.info({ host, port: config.port }, "Backend server started");
    if (database && config.nodeEnv === "production") {
      void setupTelegramWebhookIfUnclaimed(logger);
      if (hasMaxBotToken() && hasMaxWebhookSecret()) {
        void setupMaxWebhookIfUnclaimed(logger);
      }
    }
  });

  let isShuttingDown = false;
  const shutdown = (signal: NodeJS.Signals) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    logger.info({ signal }, "Backend server stopping");
    stopNewsPushWorker();
    stopCustomerOfferPushWorker();
    stopCustomerOfferWinnerPushWorker();
    stopBirthdayPushWorker();
    stopMaintenanceReminderWorker();
    stopRepairFollowUpPushWorker();
    stopOrderArchiveWorker();
    stopTelegramNotificationWorker();
    stopMaxNotificationWorker();
    stopMonthlySalaryReportWorker();
    server.close((serverError) => {
      void (database?.close() ?? Promise.resolve())
        .catch(() => {
          logger.error("Database connection shutdown failed");
          process.exitCode = 1;
        })
        .finally(() => {
          if (serverError) {
            logger.error("Backend server shutdown failed");
            process.exitCode = 1;
          }
        });
    });
  };

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
};

void start().catch((error: unknown) => {
  process.stderr.write(formatStartupError(error, process.env));
  process.exitCode = 1;
});
