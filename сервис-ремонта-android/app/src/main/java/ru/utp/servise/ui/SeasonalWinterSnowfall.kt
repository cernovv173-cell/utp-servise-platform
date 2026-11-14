package ru.utp.servise.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.unit.dp

@Composable
internal fun SeasonalWinterSnowfall(modifier: Modifier = Modifier) {
    BoxWithConstraints(modifier = modifier) {
        val transition = rememberInfiniteTransition(label = "winter-snowfall")
        repeat(28) { index ->
            val progress by transition.animateFloat(
                initialValue = 0f,
                targetValue = 1f,
                animationSpec = infiniteRepeatable(
                    animation = tween(
                        durationMillis = 7_000 + index * 170,
                        delayMillis = (index * 431) % 6_000,
                        easing = LinearEasing,
                    ),
                    repeatMode = RepeatMode.Restart,
                ),
                label = "winter-snow-$index",
            )
            val column = ((index * 37 + 11) % 100) / 100f
            val flakeSize = (2 + index % 3).dp
            Box(
                modifier = Modifier
                    .offset(
                        x = maxWidth * column + (maxWidth * 0.018f * progress),
                        y = (-8).dp + (maxHeight + 16.dp) * progress,
                    )
                    .size(flakeSize)
                    .graphicsLayer(alpha = 0.35f + (index % 4) * 0.12f)
                    .background(Color(0xFFEAF6FF), CircleShape),
            )
        }
    }
}
