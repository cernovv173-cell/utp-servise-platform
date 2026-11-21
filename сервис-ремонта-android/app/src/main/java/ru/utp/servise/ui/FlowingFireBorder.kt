package ru.utp.servise.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

internal data class FlowingFirePaletteOption(
    val key: String,
    val label: String,
    val colors: List<Color>,
)

internal val flowingFirePaletteOptions = listOf(
    FlowingFirePaletteOption(
        "EMBER",
        "Янтарный жар",
        listOf(Color(0xFF7C2D12), Color(0xFFF97316), Color(0xFFFFF1B7), Color(0xFFFB923C)),
    ),
    FlowingFirePaletteOption(
        "CYAN",
        "Ледяной голубой",
        listOf(Color(0xFF164E63), Color(0xFF06B6D4), Color(0xFFCFFAFE), Color(0xFF67E8F9)),
    ),
    FlowingFirePaletteOption(
        "VIOLET",
        "Фиолетовый",
        listOf(Color(0xFF4C1D95), Color(0xFF8B5CF6), Color(0xFFEDE9FE), Color(0xFFC4B5FD)),
    ),
    FlowingFirePaletteOption(
        "ROSE",
        "Розовый",
        listOf(Color(0xFF881337), Color(0xFFF43F5E), Color(0xFFFFE4E6), Color(0xFFFDA4AF)),
    ),
    FlowingFirePaletteOption(
        "EMERALD",
        "Изумрудный",
        listOf(Color(0xFF065F46), Color(0xFF10B981), Color(0xFFD1FAE5), Color(0xFF6EE7B7)),
    ),
    FlowingFirePaletteOption(
        "GOLD",
        "Золотой",
        listOf(Color(0xFF78350F), Color(0xFFF59E0B), Color(0xFFFEF3C7), Color(0xFFFCD34D)),
    ),
)

internal fun flowingFirePaletteColors(palette: String): List<Color> =
    flowingFirePaletteOptions.firstOrNull { it.key == palette }?.colors
        ?: flowingFirePaletteOptions.first().colors

@Composable
internal fun Modifier.flowingFireBorder(
    enabled: Boolean,
    palette: String,
    cornerRadius: Dp,
): Modifier {
    if (!enabled) return this

    val colors = remember(palette) { flowingFirePaletteColors(palette) }
    val transition = rememberInfiniteTransition(label = "flowing-fire-border")
    val phase by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 3_200, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "flowing-fire-phase",
    )

    return drawWithContent {
        drawContent()

        val samples = (0..48).map { index ->
            val offset = index / 48f
            offset to colorAt(colors, (offset + phase) % 1f)
        }.toTypedArray()
        val brush = Brush.sweepGradient(*samples, center = center)
        val borderWidth = 2.5.dp.toPx()
        val glowWidth = borderWidth * 3f
        val inset = glowWidth / 2f
        val frameSize = Size(
            width = (size.width - inset * 2f).coerceAtLeast(0f),
            height = (size.height - inset * 2f).coerceAtLeast(0f),
        )
        val radius = (cornerRadius.toPx() - inset).coerceAtLeast(0f)
        val topLeft = Offset(inset, inset)
        val frameCorner = CornerRadius(radius, radius)

        drawRoundRect(
            brush = brush,
            topLeft = topLeft,
            size = frameSize,
            cornerRadius = frameCorner,
            style = Stroke(width = glowWidth),
            alpha = 0.24f,
        )
        drawRoundRect(
            brush = brush,
            topLeft = topLeft,
            size = frameSize,
            cornerRadius = frameCorner,
            style = Stroke(width = borderWidth),
            alpha = 0.96f,
        )
    }
}

private fun colorAt(colors: List<Color>, position: Float): Color {
    val scaled = position.coerceIn(0f, 0.999_999f) * colors.size
    val startIndex = scaled.toInt()
    val endIndex = (startIndex + 1) % colors.size
    val fraction = scaled - startIndex
    val start = colors[startIndex]
    val end = colors[endIndex]
    return Color(
        red = start.red + (end.red - start.red) * fraction,
        green = start.green + (end.green - start.green) * fraction,
        blue = start.blue + (end.blue - start.blue) * fraction,
        alpha = start.alpha + (end.alpha - start.alpha) * fraction,
    )
}
