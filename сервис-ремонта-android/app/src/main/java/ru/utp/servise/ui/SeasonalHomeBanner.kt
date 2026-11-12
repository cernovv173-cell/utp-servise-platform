package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R

private data class SeasonalBannerStyle(
    val image: Int,
    val label: String,
    val title: String,
    val symbol: String,
    val background: Color,
    val accent: Color,
    val horizontalOverlay: List<Color>,
)

private val seasonalBannerStyles = mapOf(
    "SPRING" to SeasonalBannerStyle(
        image = R.drawable.seasonal_spring_banner,
        label = "ВЕСЕННЕЕ ОБНОВЛЕНИЕ",
        title = "Время для свежего старта — даже у техники.",
        symbol = "✿",
        background = Color(0xFF17382F),
        accent = Color(0xFFC5F3D7),
        horizontalOverlay = listOf(Color(0xF210352D), Color(0xD910352D), Color(0x2010352D)),
    ),
    "SUMMER" to SeasonalBannerStyle(
        image = R.drawable.seasonal_summer_banner,
        label = "ЛЕТНИЙ РЕЖИМ",
        title = "Пусть летом греет солнце, а не техника.",
        symbol = "☀",
        background = Color(0xFF3B321B),
        accent = Color(0xFFFFE7A6),
        horizontalOverlay = listOf(Color(0xF2312711), Color(0xD9312711), Color(0x20312711)),
    ),
    "AUTUMN" to SeasonalBannerStyle(
        image = R.drawable.seasonal_autumn_banner,
        label = "УЮТНАЯ ОСЕНЬ",
        title = "Домашний уют начинается с надёжной техники.",
        symbol = "🍂",
        background = Color(0xFF3B2117),
        accent = Color(0xFFFFC19B),
        horizontalOverlay = listOf(Color(0xF235190F), Color(0xD935190F), Color(0x2035190F)),
    ),
    "WINTER" to SeasonalBannerStyle(
        image = R.drawable.new_year_raccoon,
        label = "ЗИМНЕЕ НАСТРОЕНИЕ",
        title = "Пусть в новом году техника работает без сбоев.",
        symbol = "❄",
        background = Color(0xFF10203A),
        accent = Color(0xFFFFD38A),
        horizontalOverlay = listOf(Color(0xF20B1830), Color(0xD90B1830), Color(0x220B1830)),
    ),
)

@Composable
fun SeasonalHomeBanner(season: String, modifier: Modifier = Modifier) {
    val style = seasonalBannerStyles[season] ?: return

    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = style.background),
    ) {
        Box(Modifier.fillMaxWidth().height(196.dp)) {
            Image(
                painter = painterResource(style.image),
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
            Box(
                Modifier.fillMaxSize().background(Brush.horizontalGradient(style.horizontalOverlay)),
            )
            Box(
                Modifier.fillMaxSize().background(
                    Brush.verticalGradient(listOf(Color(0x220B1830), Color(0x990B1830))),
                ),
            )
            Column(
                modifier = Modifier.align(Alignment.CenterStart).fillMaxWidth(0.72f).padding(16.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    if (season == "WINTER") {
                        Image(
                            painter = painterResource(R.drawable.new_year_snowman),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(28.dp),
                        )
                    } else {
                        Text(style.symbol, color = style.accent, fontSize = 20.sp, lineHeight = 24.sp)
                    }
                    Text(
                        style.label,
                        color = style.accent,
                        fontSize = 9.sp,
                        fontWeight = FontWeight.Bold,
                        letterSpacing = 0.7.sp,
                    )
                    if (season == "WINTER") {
                        Image(
                            painter = painterResource(R.drawable.new_year_tree),
                            contentDescription = null,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.size(28.dp),
                        )
                    }
                }
                Text(
                    style.title,
                    color = Color.White,
                    fontSize = 19.sp,
                    lineHeight = 24.sp,
                    fontWeight = FontWeight.SemiBold,
                    style = MaterialTheme.typography.titleMedium,
                )
            }
        }
    }
}
