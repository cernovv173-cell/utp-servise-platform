import type { DatabaseClient } from "../../lib/database/database.js";
import { sendPushNotification } from "../notifications/push-notifications.js";
import type { CustomerOfferReward } from "./customer-offer-rewards.js";

export const customerOfferWinnerNotificationContent = (
  offerTitle: string,
  reward: CustomerOfferReward,
): { readonly title: string; readonly body: string } => {
  const details = [
    reward.prize?.trim() ? `Ваш приз: ${reward.prize.trim()}.` : null,
    reward.bonusPoints > 0
      ? `Вам начислено +${reward.bonusPoints} бонусных баллов.`
      : null,
  ].filter((detail): detail is string => detail !== null);

  return {
    title: "Поздравляем с победой! 🎉",
    body: [
      `Вы заняли ${reward.place}-е место в розыгрыше «${offerTitle}» — поздравляем!`,
      ...details,
    ].join(" "),
  };
};

export const sendCustomerOfferWinnerNotification = async (
  database: DatabaseClient,
  offer: { readonly id: string; readonly title: string },
  customerId: string,
  reward: CustomerOfferReward,
  notificationId: string,
): Promise<boolean> => {
  const device = await database.pushDeviceToken.findFirst({
    where: { userId: customerId },
    select: { id: true },
  });
  if (!device) return false;

  return sendPushNotification(database, [customerId], {
    ...customerOfferWinnerNotificationContent(offer.title, reward),
    data: {
      type: "customer_offer_winner",
      offerId: offer.id,
      notificationId,
    },
    androidTag: `customer-offer-winner-${notificationId}`,
  });
};
