package ru.utp.servise.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.TechnologyFact

@Composable
fun TechnologyFactCard(fact: TechnologyFact) {
    val uriHandler = LocalUriHandler.current
    Card(
        shape = RoundedCornerShape(17.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text(
                "Факт о компьютерных технологиях",
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = UtpBlue,
            )
            Text(
                fact.title,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
                modifier = Modifier.padding(top = 5.dp),
            )
            Text(
                fact.content,
                fontSize = 13.sp,
                color = UtpMuted,
                lineHeight = 19.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
            TextButton(onClick = { runCatching { uriHandler.openUri(fact.sourceUrl) } }) {
                Text("Источник: ${fact.sourceName}")
            }
            Text(
                "Следующий факт — около ${formatFactTime(fact.nextUpdateAt)} · обновление каждые 2 часа",
                fontSize = 11.sp,
                color = UtpMuted,
            )
        }
    }
}

private fun formatFactTime(value: String): String =
    runCatching {
        java.time.Instant.parse(value)
            .atZone(java.time.ZoneId.systemDefault())
            .format(java.time.format.DateTimeFormatter.ofPattern("HH:mm"))
    }.getOrDefault(value)
