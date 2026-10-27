package ru.utp.servise.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
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

private fun seasonalColorScheme(base: ColorScheme, season: String, dark: Boolean): ColorScheme {
    val accent = when (season) {
        "SPRING" -> if (dark) Color(0xFF83E6A0) else Color(0xFF16803C)
        "SUMMER" -> if (dark) Color(0xFFFFD166) else Color(0xFFA45C00)
        "AUTUMN" -> if (dark) Color(0xFFFFB382) else Color(0xFFA54116)
        "WINTER" -> if (dark) Color(0xFF9BE8F8) else Color(0xFF137795)
        else -> return base
    }
    val onAccent = if (dark) Color(0xFF102030) else Color.White
    val accentContainer = when (season) {
        "SPRING" -> if (dark) Color(0xFF14532D) else Color(0xFFDFF6E5)
        "SUMMER" -> if (dark) Color(0xFF693F00) else Color(0xFFFFF0C2)
        "AUTUMN" -> if (dark) Color(0xFF713414) else Color(0xFFFFE5D2)
        else -> if (dark) Color(0xFF124A5B) else Color(0xFFDCEFFA)
    }
    val onAccentContainer = when (season) {
        "SPRING" -> if (dark) Color(0xFFD2FADF) else Color(0xFF0F4625)
        "SUMMER" -> if (dark) Color(0xFFFFE9B0) else Color(0xFF5B2E00)
        "AUTUMN" -> if (dark) Color(0xFFFFDCC6) else Color(0xFF4F1D05)
        else -> if (dark) Color(0xFFC7F3FC) else Color(0xFF103D51)
    }
    return base.copy(
        primary = accent,
        onPrimary = onAccent,
        primaryContainer = accentContainer,
        onPrimaryContainer = onAccentContainer,
    )
}

@Composable
fun UtpServiseTheme(season: String = "NONE", content: @Composable () -> Unit) {
    val context = LocalContext.current
    val themeMode = remember(context) { readThemeMode(context) }
    val dark = when (themeMode) {
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
    }
    val baseColors = if (dark) {
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
    val colors = seasonalColorScheme(baseColors, season, dark)
    MaterialTheme(
        colorScheme = colors,
        shapes = Shapes(
            extraSmall = RoundedCornerShape(4.dp),
            small = RoundedCornerShape(8.dp),
            medium = RoundedCornerShape(12.dp),
            large = RoundedCornerShape(16.dp),
            extraLarge = RoundedCornerShape(24.dp),
        ),
        content = {
            Box(Modifier.fillMaxSize()) {
                SeasonalSceneBackground(season = season, dark = dark)
                content()
            }
        },
    )
}
