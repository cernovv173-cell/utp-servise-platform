package ru.utp.servise.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

private val LightPrimary = Color(0xFF087F78)
private val LightSecondary = Color(0xFF24754B)
private val LightTertiary = Color(0xFFB86A18)
val UtpBlue: Color
    @Composable get() = MaterialTheme.colorScheme.primary
val UtpInk: Color
    @Composable get() = MaterialTheme.colorScheme.onBackground
val UtpMuted: Color
    @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant
val UtpPale: Color
    @Composable get() = MaterialTheme.colorScheme.background
val UtpGreen: Color
    @Composable get() = MaterialTheme.colorScheme.secondary
val UtpMint: Color
    @Composable get() = MaterialTheme.colorScheme.secondaryContainer
val UtpAmber: Color
    @Composable get() = MaterialTheme.colorScheme.tertiary

@Composable
fun UtpServiseTheme(content: @Composable () -> Unit) {
    val context = LocalContext.current
    val themeMode = remember(context) { readThemeMode(context) }
    val dark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val colors = if (dark) {
        darkColorScheme(
            primary = Color(0xFF71D5C7),
            onPrimary = Color(0xFF003832),
            primaryContainer = Color(0xFF12564D),
            onPrimaryContainer = Color(0xFFB6F2E6),
            secondary = Color(0xFF9AD8B1),
            secondaryContainer = Color(0xFF204D3C),
            onSecondaryContainer = Color(0xFFC1F0D1),
            tertiary = Color(0xFFFFC16A),
            background = Color(0xFF101816),
            onBackground = Color(0xFFE4F0EB),
            surface = Color(0xFF1A2522),
            onSurface = Color(0xFFE4F0EB),
            surfaceVariant = Color(0xFF293632),
            onSurfaceVariant = Color(0xFFBBCBC4),
            outline = Color(0xFF71827B),
        )
    } else {
        lightColorScheme(
            primary = LightPrimary,
            onPrimary = Color.White,
            primaryContainer = Color(0xFFE1F2EC),
            onPrimaryContainer = Color(0xFF173432),
            background = Color(0xFFF4F7F3),
            onBackground = Color(0xFF173432),
            surface = Color(0xFFFFFEFC),
            onSurface = Color(0xFF173432),
            secondary = LightSecondary,
            secondaryContainer = Color(0xFFE1F2EC),
            onSecondaryContainer = Color(0xFF173432),
            tertiary = LightTertiary,
            onSurfaceVariant = Color(0xFF526760),
        )
    }
    MaterialTheme(
        colorScheme = colors,
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
