import type { Logger } from "pino";

import { getMaxWebhookSubscriptions, registerMaxWebhook } from "./max-bot.js";

export const setupMaxWebhookIfUnclaimed = async (
  logger: Logger,
): Promise<void> => {
  const targetUrl = process.env.MAX_WEBHOOK_URL?.trim();
  if (!targetUrl) {
    logger.warn(
      { code: "MAX_WEBHOOK_URL_MISSING" },
      "max_webhook_not_configured",
    );
    return;
  }
  if (!targetUrl.startsWith("https://")) {
    logger.warn(
      { code: "MAX_WEBHOOK_URL_INVALID" },
      "max_webhook_not_configured",
    );
    return;
  }

  try {
    const current = await getMaxWebhookSubscriptions();
    const subscriptions = current.subscriptions ?? [];
    if (
      subscriptions.length > 0 &&
      !subscriptions.some((subscription) => subscription.url === targetUrl)
    ) {
      logger.warn(
        { code: "MAX_WEBHOOK_ALREADY_OWNED" },
        "max_webhook_not_changed",
      );
      return;
    }
    await registerMaxWebhook(targetUrl);
    logger.info("MAX webhook registered for the repair API.");
  } catch {
    logger.warn(
      { code: "MAX_WEBHOOK_SETUP_FAILED" },
      "max_webhook_setup_will_need_retry",
    );
  }
};
