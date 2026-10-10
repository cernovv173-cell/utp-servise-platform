import type { Logger } from "pino";

import {
  getTelegramWebhookInfo,
  registerTelegramWebhook,
} from "./telegram-bot.js";

export const setupTelegramWebhookIfUnclaimed = async (
  logger: Logger,
): Promise<void> => {
  const targetUrl = process.env.TELEGRAM_WEBHOOK_URL?.trim();
  if (!targetUrl) {
    logger.warn(
      { code: "TELEGRAM_WEBHOOK_URL_MISSING" },
      "telegram_webhook_not_configured",
    );
    return;
  }

  try {
    const current = await getTelegramWebhookInfo();
    if (current.url === targetUrl) {
      await registerTelegramWebhook(targetUrl);
      logger.info("Telegram webhook confirmed for this API.");
      return;
    }
    if (current.url) {
      logger.warn(
        { code: "TELEGRAM_WEBHOOK_ALREADY_OWNED" },
        "telegram_webhook_not_changed",
      );
      return;
    }
    await registerTelegramWebhook(targetUrl);
    logger.info("Telegram webhook registered for the repair API.");
  } catch {
    logger.warn(
      { code: "TELEGRAM_WEBHOOK_SETUP_FAILED" },
      "telegram_webhook_setup_will_need_retry",
    );
  }
};
