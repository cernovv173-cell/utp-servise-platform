package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.animation.core.Spring
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.consume
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntSize
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.utp.servise.data.Match3Hint
import ru.utp.servise.data.Match3Position
import ru.utp.servise.data.Match3Tile

@Composable
internal fun Match3Board(
    board: List<List<Match3Tile>>,
    selected: Pair<Int, Int>?,
    enabled: Boolean,
    onTileSelected: (Int, Int) -> Unit,
    onTileSwiped: (Int, Int, Int, Int) -> Unit,
    swipingEnabled: Boolean = true,
    hint: Match3Hint? = null,
) {
    val gapPx = with(LocalDensity.current) { 4.dp.toPx() }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
        board.forEachIndexed { rowIndex, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp), modifier = Modifier.fillMaxWidth()) {
                row.forEachIndexed { columnIndex, tile ->
                    var dragOffset by remember(rowIndex, columnIndex) { mutableStateOf(Offset.Zero) }
                    var swipeTarget by remember(rowIndex, columnIndex) { mutableStateOf(Offset.Zero) }
                    var swipeBoard by remember(rowIndex, columnIndex) {
                        mutableStateOf<List<List<Match3Tile>>?>(null)
                    }
                    var tileSize by remember(rowIndex, columnIndex) { mutableStateOf(IntSize.Zero) }
                    val translation = if (dragOffset != Offset.Zero) dragOffset else swipeTarget
                    val animatedX by animateFloatAsState(
                        targetValue = translation.x,
                        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
                        label = "match3-swipe-x-$rowIndex-$columnIndex",
                    )
                    val animatedY by animateFloatAsState(
                        targetValue = translation.y,
                        animationSpec = spring(stiffness = Spring.StiffnessMediumLow),
                        label = "match3-swipe-y-$rowIndex-$columnIndex",
                    )
                    LaunchedEffect(board) {
                        if (swipeBoard != null && board !== swipeBoard) {
                            swipeTarget = Offset.Zero
                            swipeBoard = null
                        }
                    }
                    LaunchedEffect(swipeTarget) {
                        if (swipeTarget != Offset.Zero) {
                            delay(1500)
                            swipeTarget = Offset.Zero
                            swipeBoard = null
                        }
                    }
                    val isSelected = selected == (rowIndex to columnIndex)
                    val isHinted = hint?.let {
                        it.from == Match3Position(rowIndex, columnIndex) ||
                            it.to == Match3Position(rowIndex, columnIndex)
                    } == true
                    Box(
                        contentAlignment = Alignment.Center,
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(9.dp))
                            .background(tileBackground(tile))
                            .border(
                                width = if (isSelected || isHinted) 2.dp else 1.dp,
                                color = when {
                                    isSelected -> MaterialTheme.colorScheme.primary
                                    isHinted -> Color(0xFFFFC857)
                                    else -> MaterialTheme.colorScheme.outline.copy(alpha = 0.22f)
                                },
                                shape = RoundedCornerShape(9.dp),
                            )
                            .onSizeChanged { tileSize = it }
                            .pointerInput(enabled, swipingEnabled, rowIndex, columnIndex, tile) {
                                if (
                                    !enabled || !swipingEnabled || tile.kind == null ||
                                    tile.frozen || tile.junk
                                ) {
                                    return@pointerInput
                                }
                                detectDragGestures(
                                    onDragStart = { dragOffset = Offset.Zero },
                                    onDragEnd = {
                                        val dx = dragOffset.x
                                        val dy = dragOffset.y
                                        val width = tileSize.width.toFloat()
                                        val height = tileSize.height.toFloat()
                                        if (width > 0 && height > 0) {
                                            val horizontal = kotlin.math.abs(dx) > kotlin.math.abs(dy)
                                            val nextRow = if (horizontal) {
                                                rowIndex
                                            } else {
                                                rowIndex + (if (dy > 0) 1 else -1)
                                            }
                                            val nextColumn = if (horizontal) {
                                                columnIndex + (if (dx > 0) 1 else -1)
                                            } else {
                                                columnIndex
                                            }
                                            val distance = if (horizontal) {
                                                kotlin.math.abs(dx)
                                            } else {
                                                kotlin.math.abs(dy)
                                            }
                                            val threshold = (if (horizontal) width else height) * 0.45f
                                            if (
                                                distance >= threshold &&
                                                nextRow in board.indices &&
                                                nextColumn in row.indices
                                            ) {
                                                swipeBoard = board
                                                swipeTarget = if (horizontal) {
                                                    Offset(
                                                        (width + gapPx) * (if (dx > 0) 1 else -1),
                                                        0f,
                                                    )
                                                } else {
                                                    Offset(
                                                        0f,
                                                        (height + gapPx) * (if (dy > 0) 1 else -1),
                                                    )
                                                }
                                                onTileSwiped(
                                                    rowIndex,
                                                    columnIndex,
                                                    nextRow,
                                                    nextColumn,
                                                )
                                            }
                                        }
                                        dragOffset = Offset.Zero
                                    },
                                    onDragCancel = { dragOffset = Offset.Zero },
                                    onDrag = { change, amount ->
                                        change.consume()
                                        dragOffset += amount
                                    },
                                )
                            }
                            .graphicsLayer {
                                translationX = animatedX
                                translationY = animatedY
                                if (translation != Offset.Zero) {
                                    scaleX = 1.06f
                                    scaleY = 1.06f
                                }
                            }
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
