package ru.utp.servise.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ColorScheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

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
        "WINTER" -> if (dark) Color(0xFFFFBF72) else Color(0xFF9B5A24)
        else -> return base
    }
    val onAccent = if (dark) Color(0xFF102030) else Color.White
    val accentContainer = when (season) {
        "SPRING" -> if (dark) Color(0xFF14532D) else Color(0xFFDFF6E5)
        "SUMMER" -> if (dark) Color(0xFF693F00) else Color(0xFFFFF0C2)
        "AUTUMN" -> if (dark) Color(0xFF713414) else Color(0xFFFFE5D2)
        "WINTER" -> if (dark) Color(0xFF5A3520) else Color(0xFFFFE8CE)
        else -> if (dark) Color(0xFF124A5B) else Color(0xFFDCEFFA)
    }
    val onAccentContainer = when (season) {
        "SPRING" -> if (dark) Color(0xFFD2FADF) else Color(0xFF0F4625)
        "SUMMER" -> if (dark) Color(0xFFFFE9B0) else Color(0xFF5B2E00)
        "AUTUMN" -> if (dark) Color(0xFFFFDCC6) else Color(0xFF4F1D05)
        "WINTER" -> if (dark) Color(0xFFFFE2C2) else Color(0xFF5A351A)
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
fun UtpServiseTheme(
    season: String = "NONE",
    dark: Boolean = true,
    content: @Composable () -> Unit,
) {
    val baseColors = if (dark) darkColorScheme(
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
    else lightColorScheme(
        primary = Color(0xFF2057A5),
        onPrimary = Color.White,
        primaryContainer = Color(0xFFDCE8FF),
        onPrimaryContainer = Color(0xFF112C55),
        secondary = Color(0xFF654A9F),
        secondaryContainer = Color(0xFFECE4FF),
        onSecondaryContainer = Color(0xFF34205E),
        tertiary = Color(0xFF925200),
        background = Color(0xDDF4F6FC),
        onBackground = Color(0xFF172033),
        surface = Color(0xF2FFFFFF),
        onSurface = Color(0xFF172033),
        surfaceVariant = Color(0xFFE8EEF8),
        onSurfaceVariant = Color(0xFF536079),
        outline = Color(0xFF73809A),
    )
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
                SeasonalSceneBackground(season = season)
                content()
            }
        },
    )
}
