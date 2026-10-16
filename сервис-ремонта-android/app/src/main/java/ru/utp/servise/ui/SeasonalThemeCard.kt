package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.SeasonalThemeState
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val seasonLabels = mapOf(
    "SPRING" to "Весна",
    "SUMMER" to "Лето",
    "AUTUMN" to "Осень",
    "WINTER" to "Зима",
)

private fun formatSeasonDate(value: String): String = runCatching {
    LocalDate.parse(value).format(
        DateTimeFormatter.ofPattern("d MMMM yyyy 'г.'", Locale.forLanguageTag("ru-RU")),
    )
}.getOrDefault(value)

@Composable
fun SeasonalThemeCard(
    state: SeasonalThemeState,
    busy: Boolean,
    onSeasonChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val seasonLabel = seasonLabels[state.calendarSeason]
    val nextSeasonLabel = seasonLabels[state.nextSeason]
    val isActive = state.activeSeason == state.calendarSeason && seasonLabel != null

    Card(
        modifier = modifier.fillMaxWidth().padding(bottom = 12.dp),
        shape = MaterialTheme.shapes.large,
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Row(modifier = Modifier.fillMaxWidth()) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        "УПРАВЛЕНИЕ ДЛЯ АДМИНИСТРАТОРА",
                        color = MaterialTheme.colorScheme.primary,
                        fontSize = 11.sp,
                        fontWeight = FontWeight.Bold,
                    )
                    Text(
                        "Сезонное оформление",
                        color = UtpInk,
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                    )
                }
                if (seasonLabel != null) {
                    Text(
                        seasonLabel,
                        color = MaterialTheme.colorScheme.primary,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Text(
                when {
                    seasonLabel == null -> "Подключаем календарь сезонов…"
                    isActive -> "Оформление «$seasonLabel» включено на сайте и в Android."
                    else -> "Сейчас календарный сезон — ${seasonLabel.lowercase()}. Оформление пока выключено."
                },
                color = UtpMuted,
                fontSize = 13.sp,
            )
            if (nextSeasonLabel != null && state.nextSeasonStartsOn.isNotBlank()) {
                Text(
                    "Следующий сезон: $nextSeasonLabel — ${formatSeasonDate(state.nextSeasonStartsOn)}.",
                    color = UtpMuted,
                    fontSize = 12.sp,
                )
            }
            Button(
                onClick = { onSeasonChange(if (isActive) "NONE" else state.calendarSeason) },
                enabled = !busy && seasonLabel != null,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(
                    when {
                        busy -> "Сохраняем…"
                        seasonLabel == null -> "Календарь недоступен"
                        isActive -> "Выключить оформление"
                        else -> "Включить «$seasonLabel»"
                    },
                    fontWeight = FontWeight.SemiBold,
                )
            }
        }
    }
}
