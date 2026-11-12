package ru.utp.servise.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.width
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
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

private const val AUTUMN_RAIN_INTERVAL_MILLISECONDS = 60 * 60 * 1_000L
private const val AUTUMN_RAIN_DURATION_MILLISECONDS = 30 * 60 * 1_000L

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
                .graphicsLayer(
                    alpha = if (season == "WINTER") {
                        if (dark) 0.32f else 0.24f
                    } else if (dark) {
                        0.58f
                    } else {
                        0.72f
                    },
                ),
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
        if (season != "WINTER") SeasonalParticleField(season, Modifier.fillMaxSize())
        if (season == "AUTUMN") {
            AutumnRainSchedule()
        }
    }
}

@Composable
private fun AutumnRainSchedule() {
    var isRaining by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            delay(AUTUMN_RAIN_INTERVAL_MILLISECONDS)
            isRaining = true
            delay(AUTUMN_RAIN_DURATION_MILLISECONDS)
            isRaining = false
            delay(AUTUMN_RAIN_INTERVAL_MILLISECONDS - AUTUMN_RAIN_DURATION_MILLISECONDS)
        }
    }

    if (isRaining) AutumnRainField(Modifier.fillMaxSize())
}

@Composable
private fun AutumnRainField(modifier: Modifier = Modifier) {
    val rainColumns = List(28) { index -> (index * 37 + 5) % 100 }
    BoxWithConstraints(modifier = modifier) {
        rainColumns.forEachIndexed { index, column ->
            val transition = rememberInfiniteTransition(label = "autumn-rain-$index")
            val progress by transition.animateFloat(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(
                        durationMillis = 570 + index % 6 * 85,
                        easing = LinearEasing,
                    ),
                    repeatMode = RepeatMode.Restart,
                ),
                label = "autumn-rain-progress-$index",
            )
            Box(
                modifier = Modifier
                    .offset(
                        x = maxWidth * (column / 100f) - 1.dp,
                        y = (-26).dp + (maxHeight + 52.dp) * progress,
                    )
                    .graphicsLayer {
                        rotationZ = 14f
                        alpha = 0.48f
                    }
                    .width(1.dp)
                    .height(18.dp)
                    .background(Color(0xA66D9BBE)),
            )
        }
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
