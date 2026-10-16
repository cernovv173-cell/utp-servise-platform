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
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R

private val seasonLabels = mapOf(
    "SPRING" to "Весна",
    "SUMMER" to "Лето",
    "AUTUMN" to "Осень",
    "WINTER" to "Зима",
)

private val seasonArtwork = mapOf(
    "SPRING" to R.drawable.seasonal_spring,
    "SUMMER" to R.drawable.seasonal_summer,
    "AUTUMN" to R.drawable.seasonal_autumn,
    "WINTER" to R.drawable.seasonal_winter,
)

private val seasonParticles = mapOf(
    "SPRING" to listOf("✿", "❀", "✿", "❀", "✿"),
    "SUMMER" to listOf("✦", "✧", "✦", "✧", "✦"),
    "AUTUMN" to listOf("🍂", "🍁", "🍂", "🍁", "🍂"),
    "WINTER" to listOf("❄", "❅", "❄", "❅", "❄"),
)

@Composable
fun SeasonalSceneBanner(season: String, modifier: Modifier = Modifier) {
    val imageResource = seasonArtwork[season] ?: return
    val seasonLabel = seasonLabels[season] ?: return

    Box(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 6.dp)
            .height(132.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(MaterialTheme.colorScheme.primaryContainer)
            .semantics { contentDescription = "Сезонное оформление: $seasonLabel" },
    ) {
        Image(
            painter = painterResource(imageResource),
            contentDescription = null,
            contentScale = ContentScale.Crop,
            modifier = Modifier
                .fillMaxHeight()
                .fillMaxWidth(0.68f)
                .align(Alignment.CenterEnd),
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.horizontalGradient(
                        listOf(
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.98f),
                            MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.84f),
                            Color.Transparent,
                        ),
                    ),
                ),
        )
        SeasonalParticleField(season, Modifier.fillMaxSize())
        Column(
            modifier = Modifier
                .align(Alignment.CenterStart)
                .fillMaxWidth(0.48f)
                .padding(start = 16.dp, end = 4.dp),
        ) {
            Text(
                "СЕЗОННОЕ ОФОРМЛЕНИЕ",
                color = MaterialTheme.colorScheme.primary,
                fontSize = 10.sp,
                fontWeight = FontWeight.Bold,
                letterSpacing = 1.sp,
            )
            Text(
                seasonLabel,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
                fontSize = 22.sp,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "Ремонт компьютеров и ноутбуков",
                color = MaterialTheme.colorScheme.onPrimaryContainer.copy(alpha = 0.82f),
                fontSize = 11.sp,
                lineHeight = 14.sp,
            )
        }
    }
}

@Composable
private fun SeasonalParticleField(season: String, modifier: Modifier = Modifier) {
    val particles = seasonParticles[season] ?: return
    BoxWithConstraints(modifier = modifier.clearAndSetSemantics { }) {
        particles.forEachIndexed { index, symbol ->
            val duration = 7_000 + index * 730
            val repeatMode = if (season == "SUMMER") RepeatMode.Reverse else RepeatMode.Restart
            val transition = rememberInfiniteTransition(label = "season-particle-$index")
            val progress by transition.animateFloat(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = duration, easing = LinearEasing),
                    repeatMode = repeatMode,
                ),
                label = "season-particle-progress-$index",
            )
            val rotation by transition.animateFloat(
                initialValue = -18f,
                targetValue = 190f,
                animationSpec = infiniteRepeatable(
                    animation = tween(durationMillis = duration, easing = LinearEasing),
                    repeatMode = repeatMode,
                ),
                label = "season-particle-rotation-$index",
            )
            val verticalOffset = if (season == "SUMMER") {
                maxHeight * 0.1f * progress
            } else {
                (-14).dp + (maxHeight + 28.dp) * progress
            }
            val alpha = if (season == "SUMMER") {
                0.24f + progress * 0.62f
            } else {
                val fadeIn = (progress * 5f).coerceAtMost(0.8f)
                val fadeOut = ((1f - progress) * 5f).coerceAtMost(1f)
                fadeIn * fadeOut
            }
            val particleColor = if (season == "SUMMER") {
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
                        x = maxWidth * (0.54f + index * 0.085f),
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
