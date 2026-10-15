package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.Match3Tile

@Composable
internal fun Match3Board(
    board: List<List<Match3Tile>>,
    selected: Pair<Int, Int>?,
    enabled: Boolean,
    onTileSelected: (Int, Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
        board.forEachIndexed { rowIndex, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEachIndexed { columnIndex, tile ->
                    val isSelected = selected == (rowIndex to columnIndex)
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(9.dp))
                            .background(tileBackground(tile))
                            .border(
                                width = if (isSelected) 2.dp else 1.dp,
                                color = if (isSelected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = 0.22f),
                                shape = RoundedCornerShape(9.dp),
                            )
                            .clickable(enabled = enabled) {
                                onTileSelected(rowIndex, columnIndex)
                            }
                            .semantics {
                                contentDescription = tileDescription(tile, rowIndex, columnIndex)
                            },
                    ) {
                        Text(tileIcon(tile), fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
                        if (tile.anomalyTurns != null) {
                            Text("${tile.anomalyTurns}", fontSize = 8.sp, color = MaterialTheme.colorScheme.onSurface, modifier = Modifier.align(Alignment.BottomEnd).padding(2.dp))
                        }
                    }
                }
            }
        }
    }
}

private fun tileIcon(tile: Match3Tile): String = when {
    tile.junk -> "🪨"
    tile.frozen -> "❄️"
    tile.kind == null -> "·"
    else -> mapOf(
        "processor" to "🧠",
        "ram" to "🧩",
        "ssd" to "💽",
        "cooling" to "🌀",
        "gpu" to "🎮",
        "motherboard" to "🟩",
        "power" to "⚡",
        "case" to "🖥️",
    )[tile.kind] ?: "🔧"
}

private fun tileDescription(tile: Match3Tile, row: Int, column: Int): String = buildString {
    append("Ряд ${row + 1}, колонка ${column + 1}: ")
    append(when {
        tile.junk -> "завал"
        tile.frozen -> "замороженная ${tile.kind ?: "деталь"}"
        else -> tile.kind ?: "пустая клетка"
    })
}

private fun tileBackground(tile: Match3Tile): Color = when {
    tile.junk -> Color(0xFFE3D5BF)
    tile.frozen -> Color(0xFFD8F2FF)
    else -> Color(0xFFFFFFFF).copy(alpha = 0.88f)
}
