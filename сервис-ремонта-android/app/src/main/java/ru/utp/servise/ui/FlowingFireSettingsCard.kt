package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import ru.utp.servise.data.FlowingFireEffectSettings
import ru.utp.servise.data.FlowingFireSettings

@Composable
internal fun FlowingFireSettingsCard(
    settings: FlowingFireSettings?,
    loadFailed: Boolean,
    saving: Boolean,
    onSettingsChanged: (FlowingFireSettings) -> Unit,
    onRetry: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("Цветные анимированные рамки", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Отдельно включайте эффект для объявления и розыгрышей и выбирайте их цвета. Настройки применяются на сайте и в приложении.",
                color = UtpMuted,
                style = MaterialTheme.typography.bodySmall,
            )

            when {
                loadFailed -> {
                    Text(
                        "Не удалось загрузить настройки рамок.",
                        color = MaterialTheme.colorScheme.error,
                        style = MaterialTheme.typography.bodySmall,
                    )
                    OutlinedButton(onClick = onRetry, modifier = Modifier.fillMaxWidth()) {
                        Text("Повторить загрузку")
                    }
                }

                settings == null -> Text("Загружаем настройки…", color = UtpMuted)

                else -> {
                    FlowingFireEffectSection(
                        title = "Объявление о перерыве",
                        description = "Рамка вокруг объявления на главной странице.",
                        effect = settings.closure,
                        enabled = !saving,
                        onEffectChanged = { onSettingsChanged(settings.copy(closure = it)) },
                    )
                    FlowingFireEffectSection(
                        title = "Карточки розыгрышей",
                        description = "Отдельное оформление розыгрышей, не обычных акций.",
                        effect = settings.giveaway,
                        enabled = !saving,
                        onEffectChanged = { onSettingsChanged(settings.copy(giveaway = it)) },
                    )
                    if (saving) {
                        Text("Сохраняем…", color = UtpMuted, style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}

@Composable
private fun FlowingFireEffectSection(
    title: String,
    description: String,
    effect: FlowingFireEffectSettings,
    enabled: Boolean,
    onEffectChanged: (FlowingFireEffectSettings) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(description, color = UtpMuted, style = MaterialTheme.typography.bodySmall)
            }
            Switch(
                checked = effect.enabled,
                onCheckedChange = { onEffectChanged(effect.copy(enabled = it)) },
                enabled = enabled,
            )
        }

        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            flowingFirePaletteOptions.forEach { option ->
                FilterChip(
                    selected = effect.palette == option.key,
                    onClick = { onEffectChanged(effect.copy(palette = option.key)) },
                    enabled = enabled,
                    label = { Text(option.label, maxLines = 1) },
                    leadingIcon = {
                        Box(
                            Modifier
                                .size(14.dp)
                                .clip(CircleShape)
                                .background(option.colors[1]),
                        )
                    },
                )
            }
        }

        Card(
            modifier = Modifier
                .fillMaxWidth()
                .flowingFireBorder(
                    enabled = effect.enabled,
                    palette = effect.palette,
                    cornerRadius = 16.dp,
                ),
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(
                containerColor = if (effect.enabled) UtpBlue else MaterialTheme.colorScheme.surfaceVariant,
            ),
        ) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text(title, color = if (effect.enabled) androidx.compose.ui.graphics.Color.White else UtpMuted)
                Surface(shape = CircleShape, color = flowingFirePaletteColors(effect.palette)[1]) {
                    Box(Modifier.size(12.dp))
                }
            }
        }
    }
}
