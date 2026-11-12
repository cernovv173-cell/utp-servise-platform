import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import {
  type PushNotification,
  sendPushNotification,
} from "../notifications/push-notifications.js";

const logger = createLogger();

export const sendShopNotificationToAdministrators = async (
  database: DatabaseClient,
  notification: PushNotification,
  sendNotification: typeof sendPushNotification = sendPushNotification,
  excludeUserId?: string,
): Promise<boolean> => {
  try {
    const administrators = await database.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { id: true },
    });
    return await sendNotification(
      database,
      administrators
        .map(({ id }) => id)
        .filter((userId) => userId !== excludeUserId),
      notification,
    );
  } catch {
    logger.warn(
      { code: "SHOP_PUSH_RECIPIENTS_UNAVAILABLE" },
      "shop_push_notification_delivery_skipped",
    );
    return false;
  }
};
