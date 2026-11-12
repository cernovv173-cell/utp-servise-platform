package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.SeasonalThemeState

private val seasonLabels = mapOf(
    "SPRING" to "Весна",
    "SUMMER" to "Лето",
    "AUTUMN" to "Осень",
    "WINTER" to "Зима",
)

private data class SeasonOption(
    val key: String,
    val label: String,
    val description: String,
)

private val seasonOptions = listOf(
    SeasonOption("SPRING", "Весна", "Весенний енот, цветы и мягкие зелёные акценты."),
    SeasonOption("SUMMER", "Лето", "Летний енот, солнечная палитра и мягкие блики."),
    SeasonOption("AUTUMN", "Осень", "Осенний енот, золотые листья и мягкий дождь."),
    SeasonOption("WINTER", "Зима", "Зимний енот, снеговик и ёлочка; лёгкий снег только на сайте."),
)

@Composable
fun SeasonalThemeCard(
    state: SeasonalThemeState,
    busy: Boolean,
    onSeasonChange: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    val isLoaded = state.loaded

    Card(
        modifier = modifier.fillMaxWidth(),
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
            }
            Text(
                when {
                    !isLoaded -> "Загружаем настройки сезонного оформления…"
                    state.activeSeason == "NONE" -> "Сезонное оформление выключено."
                    else -> {
                        val activeLabel = seasonLabels[state.activeSeason].orEmpty()
                        "Включено оформление «$activeLabel»."
                    }
                },
                color = UtpMuted,
                fontSize = 13.sp,
            )
            Text(
                "Выберите любой сезон в любое время. Включение нового варианта отключит предыдущий; " +
                    "выбор сохранится на сайте и в Android до следующего изменения.",
                color = UtpMuted,
                fontSize = 12.sp,
            )
            seasonOptions.forEach { option ->
                val isActive = state.activeSeason == option.key
                Row(
                    modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            option.label,
                            color = UtpInk,
                            fontWeight = FontWeight.SemiBold,
                        )
                        Text(option.description, color = UtpMuted, fontSize = 12.sp)
                        Text(
                            if (isActive) "Включено" else "Выключено",
                            color = if (isActive) MaterialTheme.colorScheme.primary else UtpMuted,
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Medium,
                        )
                    }
                    Switch(
                        modifier = Modifier.semantics {
                            contentDescription = "Сезон ${option.label}"
                        },
                        checked = isActive,
                        enabled = !busy && isLoaded,
                        onCheckedChange = { enabled ->
                            onSeasonChange(if (enabled) option.key else "NONE")
                        },
                    )
                }
            }
            if (busy) {
                Text(
                    "Сохраняем настройки…",
                    color = UtpMuted,
                    fontSize = 12.sp,
                )
            }
        }
    }
}
