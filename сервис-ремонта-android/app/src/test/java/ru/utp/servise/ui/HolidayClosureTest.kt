package ru.utp.servise.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test
import java.time.Instant

class HolidayClosureTest {
    @Test
    fun `countdown starts at midnight Moscow time on December 31`() {
        assertEquals(
            HolidayClosureCountdown(days = 11, hours = 8, minutes = 30, seconds = 0),
            holidayClosureCountdown(Instant.parse("2026-12-30T21:00:00Z")),
        )
    }

    @Test
    fun `holiday remains active through January 10 and counts down to opening`() {
        assertEquals(
            HolidayClosureCountdown(days = 0, hours = 8, minutes = 30, seconds = 1),
            holidayClosureCountdown(Instant.parse("2027-01-10T20:59:59Z")),
        )
    }

    @Test
    fun `banner is hidden before closure and at reopening`() {
        assertNull(holidayClosureCountdown(Instant.parse("2026-12-30T20:59:59Z")))
        assertNull(holidayClosureCountdown(Instant.parse("2027-01-11T05:30:00Z")))
    }

    @Test
    fun `administrator schedule uses Moscow date and reopening time`() {
        val settings = defaultClosureAnnouncementSettings.copy(
            startDate = "2026-12-01",
            endDate = "2026-12-02",
            reopenTime = "09:15",
        )
        val reopening = Instant.parse("2026-12-03T06:15:00Z")

        assertEquals(reopening, holidayServiceReopensAt(settings))
        assertEquals(
            HolidayClosurePhase.CLOSED,
            holidayClosurePhase(Instant.parse("2026-12-02T20:59:59Z"), settings),
        )
        assertEquals(HolidayClosurePhase.REOPENED, holidayClosurePhase(reopening, settings))
        assertEquals(
            HolidayClosureCountdown(days = 0, hours = 9, minutes = 15, seconds = 1),
            holidayClosureCountdown(Instant.parse("2026-12-02T20:59:59Z"), settings),
        )
    }

    @Test
    fun `disabled closure announcement has no countdown`() {
        assertNull(
            holidayClosureCountdown(
                Instant.parse("2026-12-30T21:00:00Z"),
                defaultClosureAnnouncementSettings.copy(enabled = false),
            ),
        )
    }
}
