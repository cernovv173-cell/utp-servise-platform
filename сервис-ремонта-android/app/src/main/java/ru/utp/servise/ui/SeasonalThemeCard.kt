package ru.utp.servise.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R
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
    val iconResource: Int,
)

private val seasonOptions = listOf(
    SeasonOption(
        "SPRING",
        "Весна",
        "Фирменный енот с цветком и свежими бирюзовыми акцентами.",
        R.drawable.season_launcher_spring,
    ),
    SeasonOption(
        "SUMMER",
        "Лето",
        "Фирменный енот с солнечным значком и тёплым светом.",
        R.drawable.season_launcher_summer,
    ),
    SeasonOption(
        "AUTUMN",
        "Осень",
        "Фирменный енот с кленовым листом и янтарным свечением.",
        R.drawable.season_launcher_autumn,
    ),
    SeasonOption(
        "WINTER",
        "Зима",
        "Фирменный енот в красном шарфе со снежинкой.",
        R.drawable.season_launcher_winter,
    ),
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
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Column {
                Text(
                    "УПРАВЛЕНИЕ ДЛЯ АДМИНИСТРАТОРА",
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                )
                Text(
                    "Сезонное оформление и иконка",
                    color = UtpInk,
                    fontSize = 18.sp,
                    fontWeight = FontWeight.Bold,
                )
            }
            Text(
                when {
                    !isLoaded -> "Загружаем настройки сезонного оформления…"
                    state.activeSeason == "NONE" -> "Сейчас включена базовая иконка."
                    else -> "Сейчас выбрана иконка «${seasonLabels[state.activeSeason].orEmpty()}»."
                },
                color = UtpMuted,
                fontSize = 13.sp,
            )
            Text(
                "Нажмите на сезон, чтобы сменить оформление. Выбор сохранится общим для сайта и Android. " +
                    "Другие Android-устройства подхватят иконку при следующей синхронизации; если приложение " +
                    "закрыто — при следующем запуске.",
                color = UtpMuted,
                fontSize = 12.sp,
            )
            seasonOptions.forEach { option ->
                val isActive = state.activeSeason == option.key
                Surface(
                    modifier = Modifier
                        .fillMaxWidth()
                        .selectable(
                            selected = isActive,
                            enabled = !busy && isLoaded,
                            role = Role.RadioButton,
                            onClick = { if (!isActive) onSeasonChange(option.key) },
                        ),
                    shape = MaterialTheme.shapes.medium,
                    color = if (isActive) {
                        MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.58f)
                    } else {
                        MaterialTheme.colorScheme.surface
                    },
                    border = BorderStroke(
                        1.dp,
                        if (isActive) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.outlineVariant,
                    ),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp),
                    ) {
                        Image(
                            painter = painterResource(option.iconResource),
                            contentDescription = null,
                            modifier = Modifier
                                .size(64.dp)
                                .clip(RoundedCornerShape(12.dp)),
                            contentScale = ContentScale.Crop,
                        )
                        Column(
                            modifier = Modifier.weight(1f),
                            verticalArrangement = Arrangement.spacedBy(3.dp),
                        ) {
                            Text(
                                option.label,
                                color = UtpInk,
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                option.description,
                                color = UtpMuted,
                                fontSize = 12.sp,
                            )
                            Text(
                                if (isActive) "Включено" else "Нажмите, чтобы выбрать",
                                color = if (isActive) MaterialTheme.colorScheme.primary else UtpMuted,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Medium,
                            )
                        }
                        RadioButton(
                            selected = isActive,
                            onClick = null,
                            enabled = !busy && isLoaded,
                        )
                    }
                }
            }
            TextButton(
                onClick = { onSeasonChange("NONE") },
                enabled = !busy && isLoaded && state.activeSeason != "NONE",
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Вернуть базовую иконку")
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
