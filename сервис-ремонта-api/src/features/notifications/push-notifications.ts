import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";

const logger = createLogger();
const FIREBASE_APP_NAME = "utp-servise-push";
const MAX_MULTICAST_TOKENS = 500;

export type PushNotification = {
  readonly title: string;
  readonly body: string;
  readonly data: Readonly<Record<string, string>>;
};

export type ChatMessageRecipients = {
  readonly customerId: string;
  readonly assignedTechnicianId: string | null;
  readonly joinedAdministratorId: string | null;
  readonly senderId: string;
};

export type RepairOrderNotificationContext = {
  readonly id: string;
  readonly customerId: string;
  readonly assignedTechnicianId: string | null;
};

export const getRepairOrderNotificationRecipientIds = ({
  customerId,
  assignedTechnicianId,
  administratorIds,
  actorId,
}: RepairOrderNotificationContext & {
  readonly administratorIds: readonly string[];
  readonly actorId: string;
}): string[] =>
  [...new Set([customerId, assignedTechnicianId, ...administratorIds])].filter(
    (userId): userId is string => userId !== null && userId !== actorId,
  );

export const getChatMessageRecipientIds = ({
  customerId,
  assignedTechnicianId,
  joinedAdministratorId,
  senderId,
}: ChatMessageRecipients): string[] =>
  [
    ...new Set([customerId, assignedTechnicianId, joinedAdministratorId]),
  ].filter(
    (userId): userId is string => userId !== null && userId !== senderId,
  );

type MessagingClient = ReturnType<typeof getMessaging>;
let cachedMessagingClient: MessagingClient | null | undefined;

const getMessagingClient = (): MessagingClient | null => {
  if (cachedMessagingClient !== undefined) return cachedMessagingClient;

  const serviceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON?.trim();
  if (!serviceAccountJson) {
    cachedMessagingClient = null;
    return null;
  }

  try {
    const serviceAccount: unknown = JSON.parse(serviceAccountJson);
    const existingApp = getApps().find((app) => app.name === FIREBASE_APP_NAME);
    const app =
      existingApp ??
      initializeApp(
        { credential: cert(serviceAccount as Parameters<typeof cert>[0]) },
        FIREBASE_APP_NAME,
      );
    cachedMessagingClient = getMessaging(app);
  } catch {
    cachedMessagingClient = null;
    logger.warn(
      { code: "FCM_CONFIGURATION_INVALID" },
      "push_notifications_disabled",
    );
  }

  return cachedMessagingClient;
};

const isInvalidRegistrationToken = (code: string | undefined): boolean =>
  code === "messaging/invalid-registration-token" ||
  code === "messaging/registration-token-not-registered";

export const sendPushNotification = async (
  database: DatabaseClient,
  recipientUserIds: readonly string[],
  notification: PushNotification,
): Promise<void> => {
  const userIds = [...new Set(recipientUserIds)];
  if (userIds.length === 0) return;

  try {
    const messaging = getMessagingClient();
    if (!messaging) return;

    const devices = await database.pushDeviceToken.findMany({
      where: { userId: { in: userIds } },
      select: { token: true },
    });

    for (
      let offset = 0;
      offset < devices.length;
      offset += MAX_MULTICAST_TOKENS
    ) {
      const tokens = devices
        .slice(offset, offset + MAX_MULTICAST_TOKENS)
        .map(({ token }) => token);
      try {
        const result = await messaging.sendEachForMulticast({
          tokens,
          notification: { title: notification.title, body: notification.body },
          data: { ...notification.data },
        });
        const staleTokens = result.responses.flatMap((response, index) =>
          !response.success && isInvalidRegistrationToken(response.error?.code)
            ? [tokens[index]!]
            : [],
        );
        if (staleTokens.length > 0) {
          await database.pushDeviceToken.deleteMany({
            where: { token: { in: staleTokens } },
          });
        }
      } catch {
        logger.warn(
          { code: "FCM_SEND_FAILED" },
          "push_notification_delivery_failed",
        );
      }
    }
  } catch {
    // A committed chat action must not fail because push delivery is unavailable.
    logger.warn(
      { code: "FCM_DELIVERY_UNAVAILABLE" },
      "push_notification_delivery_skipped",
    );
  }
};

export const sendRepairOrderNotification = async (
  database: DatabaseClient,
  order: RepairOrderNotificationContext,
  actorId: string,
  body: string,
): Promise<void> => {
  try {
    const administrators = await database.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { id: true },
    });
    await sendPushNotification(
      database,
      getRepairOrderNotificationRecipientIds({
        ...order,
        administratorIds: administrators.map(({ id }) => id),
        actorId,
      }),
      {
        title: "Обновление по заявке",
        body,
        data: { type: "repair_order_update", orderId: order.id },
      },
    );
  } catch {
    logger.warn(
      { code: "ORDER_PUSH_RECIPIENTS_UNAVAILABLE" },
      "push_notification_delivery_skipped",
    );
  }
};

export const sendRepairOrderNotificationForId = async (
  database: DatabaseClient,
  orderId: string,
  actorId: string,
  body: string,
): Promise<void> => {
  try {
    const order = await database.repairOrder.findUnique({
      where: { id: orderId },
      select: { id: true, customerId: true, assignedTechnicianId: true },
    });
    if (order)
      await sendRepairOrderNotification(database, order, actorId, body);
  } catch {
    logger.warn(
      { code: "ORDER_PUSH_CONTEXT_UNAVAILABLE" },
      "push_notification_delivery_skipped",
    );
  }
};

export const sendNewsPublicationNotification = async (
  database: DatabaseClient,
  article: { readonly id: string; readonly title: string },
): Promise<void> => {
  try {
    const customers = await database.user.findMany({
      where: { role: "CUSTOMER", active: true },
      select: { id: true },
    });
    await sendPushNotification(
      database,
      customers.map(({ id }) => id),
      {
        title: "Новая новость UTP Servise",
        body: article.title,
        data: { type: "news_published", articleId: article.id },
      },
    );
  } catch {
    logger.warn(
      { code: "NEWS_PUSH_RECIPIENTS_UNAVAILABLE" },
      "push_notification_delivery_skipped",
    );
  }
};
