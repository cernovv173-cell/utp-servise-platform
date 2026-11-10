package ru.utp.servise.notifications

import org.junit.Assert.assertEquals
import org.junit.Test

class NotificationChannelRoutingTest {
    @Test
    fun winnerMessageUsesTheDedicatedCelebrationChannel() {
        assertEquals(
            NotificationChannelRouting.WINNER_CHANNEL_ID,
            NotificationChannelRouting.channelIdFor("customer_offer_winner"),
        )
    }

    @Test
    fun otherMessagesUseTheBrandUpdatesChannel() {
        assertEquals(
            NotificationChannelRouting.UPDATES_CHANNEL_ID,
            NotificationChannelRouting.channelIdFor("repair_order_update"),
        )
        assertEquals(
            NotificationChannelRouting.UPDATES_CHANNEL_ID,
            NotificationChannelRouting.channelIdFor(null),
        )
    }
}
