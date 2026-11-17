package ru.utp.servise.ui

import ru.utp.servise.data.ClosureAnnouncementSettings
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

data class HolidayClosureCountdown(
    val days: Long,
    val hours: Long,
    val minutes: Long,
    val seconds: Long,
)

private val moscowZone = ZoneId.of("Europe/Moscow")
internal val defaultClosureAnnouncementSettings = ClosureAnnouncementSettings(
    enabled = true,
    title = "НОВОГОДНИЙ ПЕРЕРЫВ",
    message = "Сервис временно не работает",
    startDate = "2026-12-31",
    endDate = "2027-01-10",
    reopenTime = "08:30",
    phoneNumber = "",
)

internal fun holidayClosureStartsAt(settings: ClosureAnnouncementSettings) =
    LocalDate.parse(settings.startDate).atStartOfDay(moscowZone).toInstant()

internal fun holidayServiceReopensAt(settings: ClosureAnnouncementSettings) =
    LocalDate.parse(settings.endDate)
        .plusDays(1)
        .atTime(LocalTime.parse(settings.reopenTime))
        .atZone(moscowZone)
        .toInstant()

internal val holidayClosureStartsAt = holidayClosureStartsAt(defaultClosureAnnouncementSettings)

internal fun holidayClosureScheduleText(settings: ClosureAnnouncementSettings): String {
    val formatter = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ru"))
    val start = LocalDate.parse(settings.startDate).format(formatter)
    val end = LocalDate.parse(settings.endDate).format(formatter)
    val reopenDate = LocalDate.parse(settings.endDate).plusDays(1).format(formatter)
    return "Перерыв — с $start по $end включительно. Откроемся $reopenDate в ${settings.reopenTime} по московскому времени."
}

enum class HolidayClosurePhase { UPCOMING, CLOSED, REOPENED }

fun holidayClosurePhase(
    now: Instant,
    settings: ClosureAnnouncementSettings = defaultClosureAnnouncementSettings,
): HolidayClosurePhase = when {
    now < holidayClosureStartsAt(settings) -> HolidayClosurePhase.UPCOMING
    now >= holidayServiceReopensAt(settings) -> HolidayClosurePhase.REOPENED
    else -> HolidayClosurePhase.CLOSED
}

fun holidayClosureCountdown(
    now: Instant,
    settings: ClosureAnnouncementSettings = defaultClosureAnnouncementSettings,
): HolidayClosureCountdown? {
    if (!settings.enabled || holidayClosurePhase(now, settings) != HolidayClosurePhase.CLOSED) return null

    var secondsRemaining = Duration.between(now, holidayServiceReopensAt(settings)).seconds
    val days = secondsRemaining / 86_400
    secondsRemaining -= days * 86_400
    val hours = secondsRemaining / 3_600
    secondsRemaining -= hours * 3_600
    val minutes = secondsRemaining / 60
    val seconds = secondsRemaining - minutes * 60
    return HolidayClosureCountdown(days, hours, minutes, seconds)
}
