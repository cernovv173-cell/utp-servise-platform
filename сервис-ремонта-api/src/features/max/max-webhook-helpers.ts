import type { DatabaseClient } from "../../lib/database/database.js";
import { sendMaxMessage } from "./max-bot.js";
import { deliverPendingCustomerCredentials } from "./max-credential-delivery.js";
import { failMaxLogin } from "./max-login.service.js";

export const sendQuietly = async (
  maxUserId: string,
  text: string,
): Promise<void> => {
  await sendMaxMessage(maxUserId, text).catch(() => undefined);
};

export const deliverCredentialsQuietly = async (
  database: DatabaseClient,
  userId: string,
  maxUserId: string,
): Promise<void> => {
  await deliverPendingCustomerCredentials(database, userId, maxUserId).catch(
    () => undefined,
  );
};

export const failAndNotify = async (
  database: DatabaseClient,
  requestId: string,
  maxUserId: string,
  code: string,
  message: string,
): Promise<void> => {
  await failMaxLogin(database, requestId, code, message, [
    "PENDING",
    "AWAITING_CONTACT",
  ]);
  await sendQuietly(maxUserId, message);
};
