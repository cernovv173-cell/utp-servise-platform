package ru.utp.servise.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

val UtpBlue = Color(0xFF087F78)
val UtpInk = Color(0xFF173432)
val UtpMuted = Color(0xFF687B77)
val UtpPale = Color(0xFFF4F7F3)
val UtpGreen = Color(0xFF24754B)
val UtpMint = Color(0xFFE1F2EC)
val UtpAmber = Color(0xFFB86A18)

@Composable
fun UtpServiseTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = UtpBlue,
            onPrimary = Color.White,
            background = UtpPale,
            surface = Color(0xFFFFFEFC),
            onSurface = UtpInk,
            secondary = UtpGreen,
            tertiary = UtpAmber,
        ),
        shapes = Shapes(
            extraSmall = RoundedCornerShape(12.dp),
            small = RoundedCornerShape(16.dp),
            medium = RoundedCornerShape(20.dp),
            large = RoundedCornerShape(26.dp),
            extraLarge = RoundedCornerShape(32.dp),
        ),
        content = content,
    )
}
