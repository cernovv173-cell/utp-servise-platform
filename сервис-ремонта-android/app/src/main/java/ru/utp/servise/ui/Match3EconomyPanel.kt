package ru.utp.servise.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.Match3Progress

private val partLabels = mapOf(
    "processor" to ("🧠" to "Процессор"),
    "ram" to ("🧩" to "Память"),
    "ssd" to ("💽" to "SSD"),
    "cooling" to ("🌀" to "Охлаждение"),
    "gpu" to ("🎮" to "Видеокарта"),
    "motherboard" to ("🟩" to "Плата"),
    "power" to ("⚡" to "Питание"),
    "case" to ("🖥️" to "Корпус"),
)

@Composable
internal fun Match3EconomyPanel(
    progress: Match3Progress,
    selectedBooster: String?,
    canUseBoosters: Boolean,
    busy: Boolean,
    onClaim: () -> Unit,
    onCraft: (String) -> Unit,
    onSelectBooster: (String?) -> Unit,
) {
    Card(
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text("Детали и бустеры", fontWeight = FontWeight.Bold, color = UtpInk)
            Text(
                "Совпадения собирают детали. Объединяйте их по рецептам и получайте бустер за каждый пройденный уровень.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            Row(
                Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                partLabels.forEach { (key, label) ->
                    Text(
                        "${label.first} ${label.second}: ${progress.inventory.parts[key] ?: 0}",
                        color = UtpInk,
                        fontSize = 12.sp,
                        modifier = Modifier.padding(vertical = 4.dp),
                    )
                }
            }
            progress.boosterCatalog.forEach { booster ->
                val count = progress.inventory.boosters[booster.id] ?: 0
                val canCraft = booster.recipe.all { (progress.inventory.parts[it.part] ?: 0) >= it.quantity }
                Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("${booster.icon} ${booster.name} · $count", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(booster.description, fontSize = 12.sp, color = UtpMuted)
                    Text(
                        "Рецепт: ${booster.recipe.joinToString(" + ") { "${it.icon} ${it.name} × ${it.quantity}" }}",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(
                            onClick = { onSelectBooster(if (selectedBooster == booster.id) null else booster.id) },
                            enabled = canUseBoosters && count > 0 && !busy,
                        ) {
                            Text(if (selectedBooster == booster.id) "Выберите клетку" else "Использовать")
                        }
                        OutlinedButton(
                            onClick = { onCraft(booster.id) },
                            enabled = canCraft && !busy,
                        ) { Text("Собрать") }
                    }
                }
            }
            Text(
                "Баллы за завершённые уровни можно забрать в любой момент; проходить всю кампанию не нужно. Доступно: ${progress.pendingGamePoints}.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            Button(
                onClick = onClaim,
                enabled = progress.pendingGamePoints > 0 && !busy,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Забрать баллы · ${progress.pendingGamePoints}")
            }
            if (selectedBooster != null) {
                Text("Выберите клетку на поле. Бустер расходует один ход.", fontSize = 12.sp, color = UtpBlue)
            }
        }
    }
}
