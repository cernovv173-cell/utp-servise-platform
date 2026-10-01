package ru.utp.servise.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.NewsArticle

@Composable
fun CustomerNewsCard(article: NewsArticle, token: String) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(15.dp)) {
            article.imageObjectId?.let { imageId ->
                RemoteProjectImage(
                    imageId,
                    token,
                    Modifier.fillMaxWidth().height(150.dp).padding(bottom = 10.dp),
                    "Фотография к новости ${article.title}",
                )
            }
            Text(article.title, fontWeight = FontWeight.SemiBold, color = UtpInk, fontSize = 15.sp)
            Text(
                article.content,
                color = UtpMuted,
                fontSize = 13.sp,
                lineHeight = 19.sp,
                modifier = Modifier.padding(top = 6.dp),
            )
        }
    }
}
