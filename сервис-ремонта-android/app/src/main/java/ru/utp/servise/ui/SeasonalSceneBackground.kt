package ru.utp.servise.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R

private val seasonArtwork = mapOf(
    "SPRING" to R.drawable.seasonal_spring,
    "SUMMER" to R.drawable.seasonal_summer,
    "AUTUMN" to R.drawable.seasonal_autumn,
    "WINTER" to R.drawable.seasonal_winter,
)

private val seasonParticles = mapOf(
    "SPRING" to listOf("✿", "❀", "✿", "❀", "✿", "❀", "✿", "❀"),
    "SUMMER" to listOf("✦", "✧", "✦", "✧", "✦", "✧", "✦", "✧"),
    "AUTUMN" to listOf("🍂", "🍁", "🍂", "🍁", "🍂", "🍁", "🍂", "🍁"),
    "WINTER" to listOf("❄", "❅", "❄", "❅", "❄", "❅", "❄", "❅"),
)

private val particleColumns = listOf(
    0.04f, 0.17f, 0.30f, 0.43f, 0.56f, 0.69f, 0.82f, 0.94f,
)

@Composable
fun SeasonalSceneBackground(season: String, dark: Boolean, modifier: Modifier = Modifier) {
    val imageResource = seasonArtwork[season] ?: return

    Box(modifier.fillMaxSize().clearAndSetSemantics { }) {
        Image(
            painter = painterResource(imageResource),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxSize()
                .graphicsLayer(alpha = if (dark) 0.58f else 0.72f),
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        listOf(
                            if (dark) Color(0x330B1024) else Color(0x14FFFFFF),
                            if (dark) Color(0x660B1024) else Color(0x22FFFFFF),
                        ),
                    ),
                ),
        )
        SeasonalParticleField(season, Modifier.fillMaxSize())
    }
}

@Composable
private fun SeasonalParticleField(season: String, modifier: Modifier = Modifier) {
    val particles = seasonParticles[season] ?: return
    BoxWithConstraints(modifier = modifier) {
        particles.forEachIndexed { index, symbol ->
            val summer = season == "SUMMER"
            val duration = 11_000 + index * 1_100
            val transition = rememberInfiniteTransition(label = "season-particle-$index")
            val progress by transition.animateFloat(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = duration, easing = LinearEasing),
                    repeatMode = if (summer) RepeatMode.Reverse else RepeatMode.Restart,
                ),
                label = "season-particle-progress-$index",
            )
            val rotation by transition.animateFloat(
                initialValue = -18f,
                targetValue = 190f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = duration, easing = LinearEasing),
                    repeatMode = if (summer) RepeatMode.Reverse else RepeatMode.Restart,
                ),
                label = "season-particle-rotation-$index",
            )
            val verticalOffset = if (summer) {
                maxHeight * 0.08f * progress
            } else {
                (-28).dp + (maxHeight + 56.dp) * progress
            }
            val alpha = if (summer) {
                0.28f + progress * 0.58f
            } else {
                (progress * 5f).coerceAtMost(0.8f) * ((1f - progress) * 5f).coerceAtMost(1f)
            }
            val particleColor = if (summer) {
                MaterialTheme.colorScheme.tertiary
            } else {
                MaterialTheme.colorScheme.primary
            }

            Text(
                text = symbol,
                color = particleColor,
                fontSize = (15 + index % 3 * 3).sp,
                modifier = Modifier
                    .offset(
                        x = maxWidth * particleColumns[index] - 8.dp,
                        y = verticalOffset,
                    )
                    .graphicsLayer {
                        rotationZ = rotation
                        this.alpha = alpha
                    },
            )
        }
    }
}
