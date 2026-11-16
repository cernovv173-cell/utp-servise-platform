package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.NewsArticle
import ru.utp.servise.data.SiteBanner
import ru.utp.servise.data.TechnologyFact
import java.time.Instant

@Composable
fun NewsFeedScreen(
    token: String,
    articles: List<NewsArticle>,
    reviews: List<CustomerReview>,
    banners: List<SiteBanner>,
    onCampaignNavigate: (String) -> Unit,
    technologyFact: TechnologyFact? = null,
) {
    val birthdayEndsAt = articles.firstOrNull { it.id.startsWith("personal-birthday-") }?.endsAt
    var currentTimeMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(birthdayEndsAt) {
        birthdayEndsAt?.let { value ->
            val millisecondsUntilExpiry = runCatching {
                java.time.Instant.parse(value).toEpochMilli() - System.currentTimeMillis()
            }.getOrDefault(0)
            if (millisecondsUntilExpiry > 0) delay(millisecondsUntilExpiry)
            currentTimeMillis = System.currentTimeMillis()
        }
    }
    val visibleArticles = articles.filter { article ->
        article.isPublished &&
            (!article.id.startsWith("personal-birthday-") || runCatching {
                article.endsAt?.let { java.time.Instant.parse(it).toEpochMilli() > currentTimeMillis } == true
            }.getOrDefault(false))
    }
    val visibleNews = visibleArticles.filter { it.kind != "WORK_STORY" }
    val visibleWorkStories = visibleArticles.filter { it.kind == "WORK_STORY" }
    val visibleReviews = reviews.filter { it.isPublished }
    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Новости, отзывы и примеры работ", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                CampaignBannerCarousel(
                    banners = banners,
                    placement = "NEWS",
                    token = token,
                    onNavigate = onCampaignNavigate,
                )
                technologyFact?.let { TechnologyFactCard(it) }
            }
        }
        items(visibleNews, key = { "article-${it.id}" }) { article ->
            Card(
                shape = RoundedCornerShape(17.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    article.imageObjectId?.let { image ->
                        RemoteProjectImage(
                            image,
                            token,
                            Modifier.fillMaxWidth().height(170.dp),
                            "Изображение: ${article.title}",
                        )
                    }
                    Text(
                        article.title,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpInk,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Text(
                        article.content,
                        fontSize = 13.sp,
                        color = UtpMuted,
                        lineHeight = 19.sp,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    article.publishedAt?.let {
                        Text(
                            formatNewsDate(it),
                            fontSize = 11.sp,
                            color = UtpMuted,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }
            }
        }
        items(visibleWorkStories, key = { "work-story-${it.id}" }) { story ->
            Card(
                shape = RoundedCornerShape(17.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    story.imageObjectId?.let { image ->
                        RemoteProjectImage(
                            image,
                            token,
                            Modifier.fillMaxWidth().height(170.dp),
                            "Фото к примеру работы: ${story.title}",
                        )
                    }
                    Text(
                        "Пример работы от сервиса · не отзыв клиента",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpBlue,
                    )
                    Text(
                        story.title,
                        fontSize = 17.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpInk,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Text(
                        story.content,
                        fontSize = 13.sp,
                        color = UtpMuted,
                        lineHeight = 19.sp,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    story.publishedAt?.let {
                        Text(
                            formatNewsDate(it),
                            fontSize = 11.sp,
                            color = UtpMuted,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                    }
                }
            }
        }
        items(visibleReviews, key = { "review-${it.id}" }) { review ->
            Card(
                shape = RoundedCornerShape(17.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    review.imageObjectId?.let { image ->
                        RemoteProjectImage(
                            image,
                            token,
                            Modifier.fillMaxWidth().height(170.dp),
                            "Фотография к отзыву",
                        )
                    }
                    Text(
                        "Отзыв клиента · ★ ${review.rating}/5",
                        fontSize = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpInk,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Text(
                        review.comment,
                        fontSize = 13.sp,
                        color = UtpMuted,
                        lineHeight = 19.sp,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    Text(
                        "${review.customerName.ifBlank { "Клиент" }} · ${formatNewsDate(review.createdAt)}",
                        fontSize = 11.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
            }
        }
        if (visibleNews.isEmpty() && visibleWorkStories.isEmpty() && visibleReviews.isEmpty()) {
            item { Text("Пока нет опубликованных новостей, отзывов и примеров работ.", color = UtpMuted) }
        }
    }
}

private fun formatNewsDate(value: String): String =
    runCatching { Instant.parse(value).atZone(java.time.ZoneId.systemDefault()).toLocalDate().toString() }
        .getOrDefault(value.take(10))

