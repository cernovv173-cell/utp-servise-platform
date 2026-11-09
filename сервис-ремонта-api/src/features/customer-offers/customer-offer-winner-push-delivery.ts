import type { DatabaseClient } from "../../lib/database/database.js";

type CustomerOfferWinnerPushDeliveryStore = Pick<
  DatabaseClient,
  "customerOfferWinnerPushDelivery"
>;

export const scheduleCustomerOfferWinnerPush = async (
  database: CustomerOfferWinnerPushDeliveryStore,
  offerId: string,
  winnerCustomerIds: readonly string[],
): Promise<void> => {
  const uniqueCustomerIds = [...new Set(winnerCustomerIds)];
  if (uniqueCustomerIds.length === 0) return;

  await database.customerOfferWinnerPushDelivery.createMany({
    data: uniqueCustomerIds.map((customerId) => ({ offerId, customerId })),
    skipDuplicates: true,
  });
};
