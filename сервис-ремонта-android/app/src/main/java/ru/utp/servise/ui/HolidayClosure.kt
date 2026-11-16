package ru.utp.servise.ui

import java.time.Duration
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

data class HolidayClosureCountdown(
    val days: Long,
    val hours: Long,
    val minutes: Long,
    val seconds: Long,
)

private val moscowZone = ZoneId.of("Europe/Moscow")
internal val holidayClosureStartsAt = ZonedDateTime.of(2026, 12, 31, 0, 0, 0, 0, moscowZone).toInstant()
private val serviceReopensAt = ZonedDateTime.of(2027, 1, 11, 8, 30, 0, 0, moscowZone).toInstant()

enum class HolidayClosurePhase { UPCOMING, CLOSED, REOPENED }

fun holidayClosurePhase(now: Instant): HolidayClosurePhase = when {
    now < holidayClosureStartsAt -> HolidayClosurePhase.UPCOMING
    now >= serviceReopensAt -> HolidayClosurePhase.REOPENED
    else -> HolidayClosurePhase.CLOSED
}

fun holidayClosureCountdown(now: Instant): HolidayClosureCountdown? {
    if (holidayClosurePhase(now) != HolidayClosurePhase.CLOSED) return null

    var secondsRemaining = Duration.between(now, serviceReopensAt).seconds
    val days = secondsRemaining / 86_400
    secondsRemaining -= days * 86_400
    val hours = secondsRemaining / 3_600
    secondsRemaining -= hours * 3_600
    val minutes = secondsRemaining / 60
    val seconds = secondsRemaining - minutes * 60
    return HolidayClosureCountdown(days, hours, minutes, seconds)
}
