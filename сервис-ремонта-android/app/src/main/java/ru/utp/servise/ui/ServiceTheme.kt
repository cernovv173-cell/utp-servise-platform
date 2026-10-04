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

private val LightPrimary = Color(0xFF405BE8)
private val LightSecondary = Color(0xFF187EBC)
private val LightTertiary = Color(0xFF7448C8)
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
            primary = Color(0xFF83E8FF),
            onPrimary = Color(0xFF002B44),
            primaryContainer = Color(0xFF173B74),
            onPrimaryContainer = Color(0xFFBBDFFF),
            secondary = Color(0xFFD2B8FF),
            secondaryContainer = Color(0xFF37235F),
            onSecondaryContainer = Color(0xFFE8D9FF),
            tertiary = Color(0xFFFFC66E),
            background = Color(0xC90B1024),
            onBackground = Color(0xFFEAF1FF),
            surface = Color(0xF116203D),
            onSurface = Color(0xFFEAF1FF),
            surfaceVariant = Color(0xFF202E52),
            onSurfaceVariant = Color(0xFFBECBEA),
            outline = Color(0xFF7183B2),
        )
    } else {
        lightColorScheme(
            primary = LightPrimary,
            onPrimary = Color.White,
            primaryContainer = Color(0xFFE5EAFF),
            onPrimaryContainer = Color(0xFF1D2F82),
            background = Color(0xF2F5F7FC),
            onBackground = Color(0xFF141A35),
            surface = Color(0xFFFEFEFF),
            onSurface = Color(0xFF141A35),
            secondary = LightSecondary,
            secondaryContainer = Color(0xFFDDF1FF),
            onSecondaryContainer = Color(0xFF113953),
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
