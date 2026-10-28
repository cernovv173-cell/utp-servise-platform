import type { DatabaseClient } from "../../lib/database/database.js";

type CustomerOfferPushDeliveryStore = Pick<
  DatabaseClient,
  "customerOfferPushDelivery"
>;

export const scheduleCustomerOfferPush = async (
  database: CustomerOfferPushDeliveryStore,
  offerId: string,
  now = new Date(),
): Promise<void> => {
  const existing = await database.customerOfferPushDelivery.findUnique({
    where: { offerId },
    select: { sentAt: true },
  });
  if (existing?.sentAt) return;

  await database.customerOfferPushDelivery.upsert({
    where: { offerId },
    create: { offerId, nextAttemptAt: now },
    update: {
      nextAttemptAt: now,
      lockedUntil: null,
      attemptCount: 0,
      lastError: null,
    },
  });
};
