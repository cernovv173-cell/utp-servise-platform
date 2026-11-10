package ru.utp.servise.notifications

object NotificationChannelRouting {
    const val UPDATES_CHANNEL_ID = "repair_updates_soft_spark"
    const val WINNER_CHANNEL_ID = "repair_winner_soft_spark"

    fun channelIdFor(type: String?): String =
        if (type == CUSTOMER_OFFER_WINNER_TYPE) WINNER_CHANNEL_ID else UPDATES_CHANNEL_ID

    private const val CUSTOMER_OFFER_WINNER_TYPE = "customer_offer_winner"
}
