package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R
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
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
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
                }
                Spacer(Modifier.width(12.dp))
                Image(
                    painter = painterResource(R.drawable.technology_raccoon),
                    contentDescription = "Техно-енот в костюме держит глобус",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(112.dp).clip(RoundedCornerShape(14.dp)),
                )
            }
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
                "При следующем открытии приложения появится другой факт. Карточка также обновляется автоматически.",
                fontSize = 11.sp,
                color = UtpMuted,
            )
            Text(
                "Наш проводник по миру технологий",
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium,
                color = UtpBlue,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}
