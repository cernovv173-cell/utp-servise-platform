package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Test
import ru.utp.servise.data.PublicCustomerOffer
import java.time.Instant

class CustomerOfferHomeBannersTest {
    @Test
    fun showsOnlyOffersWhoseStartHasPassedAndEndHasNotArrived() {
        val now = Instant.parse("2026-10-28T12:00:00Z").toEpochMilli()
        val offers = listOf(
            offer("starts-now", "2026-10-28T12:00:00Z", "2026-10-28T13:00:00Z"),
            offer("starts-later", "2026-10-28T12:00:01Z", "2026-10-28T13:00:00Z"),
            offer("ends-now", "2026-10-28T11:00:00Z", "2026-10-28T12:00:00Z"),
            offer("already-ended", "2026-10-28T10:00:00Z", "2026-10-28T11:59:59Z"),
            offer("invalid-date", "not-a-date", "2026-10-28T14:00:00Z"),
        )

        assertEquals(
            listOf("starts-now"),
            activePublicCustomerOffers(offers, now).map(PublicCustomerOffer::id),
        )
    }

    @Test
    fun sortsActiveOffersBySoonestEndTime() {
        val now = Instant.parse("2026-10-28T12:00:00Z").toEpochMilli()
        val offers = listOf(
            offer("later", "2026-10-28T10:00:00Z", "2026-10-28T15:00:00Z"),
            offer("sooner", "2026-10-28T10:00:00Z", "2026-10-28T13:00:00Z"),
        )

        assertEquals(
            listOf("sooner", "later"),
            activePublicCustomerOffers(offers, now).map(PublicCustomerOffer::id),
        )
    }

    private fun offer(id: String, startsAt: String, endsAt: String) = PublicCustomerOffer(
        id = id,
        type = "GIVEAWAY",
        title = id,
        content = "",
        firstPlacePrize = null,
        firstPlacePoints = 0,
        secondPlacePrize = null,
        secondPlacePoints = 0,
        thirdPlacePrize = null,
        thirdPlacePoints = 0,
        startsAt = startsAt,
        endsAt = endsAt,
    )
}
