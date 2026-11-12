package ru.utp.servise.notifications

object NotificationChannelRouting {
    const val UPDATES_CHANNEL_ID = "repair_updates_soft_spark"
    const val WINNER_CHANNEL_ID = "repair_winner_soft_spark"
    const val SHOP_CHANNEL_ID = "repair_shop_soft_spark"

    fun channelIdFor(type: String?): String =
        when (type) {
            CUSTOMER_OFFER_WINNER_TYPE -> WINNER_CHANNEL_ID
            SHOP_ORDER_CREATED_TYPE, SHOP_DELIVERY_RESPONSE_TYPE -> SHOP_CHANNEL_ID
            else -> UPDATES_CHANNEL_ID
        }

    private const val CUSTOMER_OFFER_WINNER_TYPE = "customer_offer_winner"
    private const val SHOP_ORDER_CREATED_TYPE = "shop_order_created"
    private const val SHOP_DELIVERY_RESPONSE_TYPE = "shop_delivery_response"
}
