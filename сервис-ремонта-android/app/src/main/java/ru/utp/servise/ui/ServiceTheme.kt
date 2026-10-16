package ru.utp.servise.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.ColorScheme
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

private fun seasonalColorScheme(base: ColorScheme, season: String, dark: Boolean): ColorScheme =
    when (season) {
        "SPRING" -> if (dark) base.copy(
            primary = Color(0xFF83E6A0), onPrimary = Color(0xFF093A1A),
            primaryContainer = Color(0xFF14532D), onPrimaryContainer = Color(0xFFD2FADF),
            secondary = Color(0xFF6EE7B7), secondaryContainer = Color(0xFF064E3B),
            onSecondaryContainer = Color(0xFFBBF7D0), tertiary = Color(0xFFFFD08A),
            tertiaryContainer = Color(0xFF5A3A0C), onTertiaryContainer = Color(0xFFFFE8C3),
        ) else base.copy(
            primary = Color(0xFF16803C), onPrimary = Color.White,
            primaryContainer = Color(0xFFDFF6E5), onPrimaryContainer = Color(0xFF0F4625),
            secondary = Color(0xFF0E7C5B), secondaryContainer = Color(0xFFD4F2E4),
            onSecondaryContainer = Color(0xFF064632), tertiary = Color(0xFFB76500),
            tertiaryContainer = Color(0xFFFFF0D5), onTertiaryContainer = Color(0xFF4E2A00),
        )
        "SUMMER" -> if (dark) base.copy(
            primary = Color(0xFFFFD166), onPrimary = Color(0xFF4A2B00),
            primaryContainer = Color(0xFF693F00), onPrimaryContainer = Color(0xFFFFE9B0),
            secondary = Color(0xFFFFB74D), secondaryContainer = Color(0xFF593100),
            onSecondaryContainer = Color(0xFFFFE2B0), tertiary = Color(0xFF7DD3FC),
            tertiaryContainer = Color(0xFF073D55), onTertiaryContainer = Color(0xFFBDEBFF),
        ) else base.copy(
            primary = Color(0xFFA45C00), onPrimary = Color.White,
            primaryContainer = Color(0xFFFFF0C2), onPrimaryContainer = Color(0xFF5B2E00),
            secondary = Color(0xFFC26700), secondaryContainer = Color(0xFFFFE7B3),
            onSecondaryContainer = Color(0xFF513000), tertiary = Color(0xFF057899),
            tertiaryContainer = Color(0xFFD9F3FA), onTertiaryContainer = Color(0xFF063D50),
        )
        "AUTUMN" -> if (dark) base.copy(
            primary = Color(0xFFFFB382), onPrimary = Color(0xFF4B1D08),
            primaryContainer = Color(0xFF713414), onPrimaryContainer = Color(0xFFFFDCC6),
            secondary = Color(0xFFF6A36D), secondaryContainer = Color(0xFF5A2B13),
            onSecondaryContainer = Color(0xFFFFDCC6), tertiary = Color(0xFFC7B5FF),
            tertiaryContainer = Color(0xFF3C2B6B), onTertiaryContainer = Color(0xFFE5DCFF),
        ) else base.copy(
            primary = Color(0xFFA54116), onPrimary = Color.White,
            primaryContainer = Color(0xFFFFE5D2), onPrimaryContainer = Color(0xFF4F1D05),
            secondary = Color(0xFF9C4221), secondaryContainer = Color(0xFFF7DCC8),
            onSecondaryContainer = Color(0xFF4D2413), tertiary = Color(0xFF674AB3),
            tertiaryContainer = Color(0xFFEAE2FF), onTertiaryContainer = Color(0xFF28145D),
        )
        "WINTER" -> if (dark) base.copy(
            primary = Color(0xFF9BE8F8), onPrimary = Color(0xFF003642),
            primaryContainer = Color(0xFF124A5B), onPrimaryContainer = Color(0xFFC7F3FC),
            secondary = Color(0xFFA9DFEC), secondaryContainer = Color(0xFF174653),
            onSecondaryContainer = Color(0xFFC9F0F7), tertiary = Color(0xFFC4C9FF),
            tertiaryContainer = Color(0xFF353D75), onTertiaryContainer = Color(0xFFE2E3FF),
        ) else base.copy(
            primary = Color(0xFF137795), onPrimary = Color.White,
            primaryContainer = Color(0xFFDCEFFA), onPrimaryContainer = Color(0xFF103D51),
            secondary = Color(0xFF137B93), secondaryContainer = Color(0xFFDDF5F9),
            onSecondaryContainer = Color(0xFF103E4A), tertiary = Color(0xFF5160B8),
            tertiaryContainer = Color(0xFFE5E8FF), onTertiaryContainer = Color(0xFF202F79),
        )
        else -> base
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
            extraSmall = RoundedCornerShape(12.dp),
            small = RoundedCornerShape(16.dp),
            medium = RoundedCornerShape(20.dp),
            large = RoundedCornerShape(26.dp),
            extraLarge = RoundedCornerShape(32.dp),
        ),
        content = content,
    )
}
