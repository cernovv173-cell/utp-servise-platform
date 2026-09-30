package ru.utp.servise.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val UtpBlue = Color(0xFF2478F2)
val UtpInk = Color(0xFF17253A)
val UtpMuted = Color(0xFF738197)
val UtpPale = Color(0xFFF3F7FC)
val UtpGreen = Color(0xFF16865B)

@Composable
fun UtpServiseTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = lightColorScheme(
            primary = UtpBlue,
            onPrimary = Color.White,
            background = UtpPale,
            surface = Color.White,
            onSurface = UtpInk,
            secondary = UtpGreen,
        ),
        content = content,
    )
}
