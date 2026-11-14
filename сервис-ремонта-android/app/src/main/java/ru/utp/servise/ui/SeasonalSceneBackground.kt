package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import ru.utp.servise.R

private val seasonalMascots = mapOf(
    "SPRING" to R.drawable.seasonal_mascot_spring,
    "SUMMER" to R.drawable.seasonal_mascot_summer,
    "AUTUMN" to R.drawable.seasonal_mascot_autumn,
    "WINTER" to R.drawable.seasonal_mascot_winter,
)

@Composable
fun SeasonalSceneBackground(season: String, modifier: Modifier = Modifier) {
    val mascotResource = seasonalMascots[season] ?: return

    Box(modifier.fillMaxSize().clearAndSetSemantics { }) {
        Image(
            painter = painterResource(mascotResource),
            contentDescription = null,
            contentScale = ContentScale.Fit,
            alignment = Alignment.BottomEnd,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .fillMaxWidth(0.52f)
                .fillMaxHeight(0.56f)
                .graphicsLayer(alpha = 0.44f),
        )
    }
}
