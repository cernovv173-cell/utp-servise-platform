export const ANDROID_UPDATES_PUSH_CHANNEL_ID =
  "repair_updates_soft_spark" as const;
export const ANDROID_WINNER_PUSH_CHANNEL_ID =
  "repair_winner_soft_spark" as const;
export const ANDROID_SHOP_PUSH_CHANNEL_ID = "repair_shop_soft_spark" as const;

export const androidPushChannelIdForType = (
  type: string | undefined,
): string =>
  type === "customer_offer_winner"
    ? ANDROID_WINNER_PUSH_CHANNEL_ID
    : type === "shop_order_created" ||
        type === "shop_order_updated" ||
        type === "shop_delivery_response"
      ? ANDROID_SHOP_PUSH_CHANNEL_ID
      : ANDROID_UPDATES_PUSH_CHANNEL_ID;
