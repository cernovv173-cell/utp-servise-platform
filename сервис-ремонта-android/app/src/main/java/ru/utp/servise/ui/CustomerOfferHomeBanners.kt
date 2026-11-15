package ru.utp.servise.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.PublicCustomerOffer
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun CustomerOfferHomeBanners(
    onOpenOffers: () -> Unit,
    modifier: Modifier = Modifier,
    compact: Boolean = false,
) {
    var offers by remember { mutableStateOf<List<PublicCustomerOffer>>(emptyList()) }
    var currentTimeMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var hasLoaded by remember { mutableStateOf(false) }
    var loadFailed by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        while (true) {
            val result = withContext(Dispatchers.IO) {
                runCatching { ApiClient.publicCustomerOffers() }
            }
            result.onSuccess {
                offers = it
                loadFailed = false
            }.onFailure {
                loadFailed = true
            }
            hasLoaded = true
            currentTimeMillis = System.currentTimeMillis()
            delay(30_000)
        }
    }

    val activeOffers = remember(offers, currentTimeMillis) {
        activePublicCustomerOffers(offers, currentTimeMillis)
    }

    if (compact) {
        Column(
            modifier = modifier,
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Акции, розыгрыши и квизы",
                    modifier = Modifier.weight(1f),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
                TextButton(onClick = onOpenOffers) { Text("Все →") }
            }
            if (activeOffers.isEmpty()) {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(18.dp),
                    colors = CardDefaults.cardColors(containerColor = UtpMint),
                ) {
                    Text(
                        text = when {
                            !hasLoaded -> "Загружаем предложения…"
                            loadFailed -> "Не удалось загрузить предложения. Откройте раздел, чтобы посмотреть их."
                            else -> "Сейчас нет активных предложений. Новые акции, розыгрыши и квизы появятся здесь."
                        },
                        modifier = Modifier.fillMaxWidth().padding(16.dp),
                        fontSize = 13.sp,
                        lineHeight = 19.sp,
                        color = UtpInk,
                    )
                }
            } else {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    items(activeOffers.take(3), key = PublicCustomerOffer::id) { offer ->
                        CompactCustomerOfferCard(offer, onOpenOffers)
                    }
                }
            }
        }
    } else if (activeOffers.isNotEmpty()) {
        Column(
            modifier = modifier,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Действующие акции, розыгрыши и квизы",
                fontSize = 20.sp,
                fontWeight = FontWeight.Bold,
                color = UtpInk,
            )
            activeOffers.take(3).forEach { offer ->
                CustomerOfferBanner(offer, onOpenOffers)
            }
        }
    }
}

@Composable
private fun CompactCustomerOfferCard(
    offer: PublicCustomerOffer,
    onClick: () -> Unit,
) {
    val isQuiz = offer.type == "QUIZ"
    val isGiveaway = offer.type == "GIVEAWAY"
    val backgroundColor = if (isGiveaway) UtpBlue else UtpMint
    val foregroundColor = if (isGiveaway) Color.White else UtpInk

    Card(
        modifier = Modifier.width(290.dp).clickable(onClick = onClick),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
    ) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    when {
                        isQuiz -> "КВИЗ"
                        isGiveaway -> "РОЗЫГРЫШ"
                        else -> "АКЦИЯ"
                    },
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Bold,
                    color = foregroundColor,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "До ${formatPublicOfferDate(offer.endsAt)}",
                    fontSize = 10.sp,
                    color = foregroundColor.copy(alpha = 0.86f),
                )
            }
            Text(
                offer.title,
                fontSize = 18.sp,
                lineHeight = 22.sp,
                fontWeight = FontWeight.Bold,
                color = foregroundColor,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            offer.content.takeIf(String::isNotBlank)?.let { content ->
                Text(
                    content,
                    fontSize = 12.sp,
                    lineHeight = 17.sp,
                    color = foregroundColor.copy(alpha = 0.9f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            if (isGiveaway || isQuiz) {
                offer.rewardSummary()?.let { reward ->
                    Text(
                        reward,
                        fontSize = 11.sp,
                        lineHeight = 15.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = foregroundColor,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                PublicOfferPrizeImages(offer)
            }
            Text(
                when {
                    isQuiz -> "Ответить и участвовать →"
                    isGiveaway -> "Подробнее и участвовать →"
                    else -> "Подробнее об акции →"
                },
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = foregroundColor,
            )
        }
    }
}

@Composable
private fun CustomerOfferBanner(offer: PublicCustomerOffer, onOpenOffers: () -> Unit) {
    val isQuiz = offer.type == "QUIZ"
    val isGiveaway = offer.type == "GIVEAWAY"
    val backgroundColor = if (isGiveaway) UtpBlue else UtpMint
    val foregroundColor = if (isGiveaway) Color.White else UtpInk
    val buttonColor = if (isGiveaway) Color.White else UtpBlue
    val buttonTextColor = if (isGiveaway) UtpBlue else Color.White

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(containerColor = backgroundColor),
    ) {
        Column(
            modifier = Modifier.padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    when {
                        isQuiz -> "КВИЗ"
                        isGiveaway -> "РОЗЫГРЫШ"
                        else -> "АКЦИЯ"
                    },
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = foregroundColor,
                )
                Spacer(Modifier.weight(1f))
                Text(
                    "До ${formatPublicOfferDate(offer.endsAt)}",
                    fontSize = 11.sp,
                    color = foregroundColor.copy(alpha = 0.86f),
                )
            }
            Text(
                offer.title,
                fontSize = 22.sp,
                lineHeight = 27.sp,
                fontWeight = FontWeight.Bold,
                color = foregroundColor,
            )
            offer.content.takeIf(String::isNotBlank)?.let { content ->
                Text(
                    content,
                    fontSize = 14.sp,
                    lineHeight = 20.sp,
                    color = foregroundColor.copy(alpha = 0.9f),
                    maxLines = 3,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            offer.rewardSummary()?.let { reward ->
                Text(
                    reward,
                    fontSize = 13.sp,
                    lineHeight = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = foregroundColor,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            PublicOfferPrizeImages(offer)
            Button(
                onClick = onOpenOffers,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = buttonColor,
                    contentColor = buttonTextColor,
                ),
            ) {
                Text(
                    when {
                        isQuiz -> "Ответить и участвовать →"
                        isGiveaway -> "Подробнее и участвовать →"
                        else -> "Подробнее об акции →"
                    },
                )
            }
        }
    }
}

@Composable
private fun PublicOfferPrizeImages(offer: PublicCustomerOffer) {
    val images = listOf(
        1 to offer.firstPlacePrizeImageId,
        2 to offer.secondPlacePrizeImageId,
        3 to offer.thirdPlacePrizeImageId,
    ).filter { it.second != null }
    if (images.isEmpty()) return
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        images.forEach { (place, _) ->
            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                RemotePublicOfferPrizeImage(
                    offerId = offer.id,
                    place = place,
                    modifier = Modifier.size(72.dp),
                    contentDescription = "Фото приза за $place место",
                )
                Text("$place место", fontSize = 10.sp, color = UtpMuted)
            }
        }
    }
}

internal fun activePublicCustomerOffers(
    offers: List<PublicCustomerOffer>,
    nowMillis: Long,
): List<PublicCustomerOffer> = offers
    .mapNotNull { offer ->
        val startsAt = offer.startsAt.toEpochMillisOrNull() ?: return@mapNotNull null
        val endsAt = offer.endsAt.toEpochMillisOrNull() ?: return@mapNotNull null
        if (startsAt <= nowMillis && nowMillis < endsAt) offer to endsAt else null
    }
    .sortedBy { it.second }
    .map { it.first }

private fun String.toEpochMillisOrNull(): Long? =
    runCatching { Instant.parse(this).toEpochMilli() }.getOrNull()

private fun PublicCustomerOffer.rewardSummary(): String? {
    val rewards = listOf(
        Triple("1 место", firstPlacePrize, firstPlacePoints),
        Triple("2 место", secondPlacePrize, secondPlacePoints),
        Triple("3 место", thirdPlacePrize, thirdPlacePoints),
    ).mapNotNull { (place, prize, points) ->
        listOfNotNull(
            prize?.takeIf(String::isNotBlank),
            "$points баллов".takeIf { points > 0 },
        ).joinToString(" · ").takeIf(String::isNotBlank)?.let { "$place: $it" }
    }
    return rewards.takeIf { it.isNotEmpty() }?.joinToString(
        separator = "  •  ",
        prefix = "Призы: ",
    )
}

private fun formatPublicOfferDate(value: String): String = runCatching {
    Instant.parse(value)
        .atZone(ZoneId.systemDefault())
        .format(DateTimeFormatter.ofPattern("d MMM, HH:mm", Locale.forLanguageTag("ru")))
}.getOrDefault(value.take(16).replace('T', ' '))
