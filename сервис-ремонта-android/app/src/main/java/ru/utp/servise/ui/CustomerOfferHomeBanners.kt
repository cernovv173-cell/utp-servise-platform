package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
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
) {
    var offers by remember { mutableStateOf<List<PublicCustomerOffer>>(emptyList()) }
    var currentTimeMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }

    LaunchedEffect(Unit) {
        while (true) {
            runCatching {
                withContext(Dispatchers.IO) { ApiClient.publicCustomerOffers() }
            }.onSuccess { offers = it }
            currentTimeMillis = System.currentTimeMillis()
            delay(30_000)
        }
    }

    val activeOffers = remember(offers, currentTimeMillis) {
        activePublicCustomerOffers(offers, currentTimeMillis)
    }

    if (activeOffers.isNotEmpty()) {
        Column(
            modifier = modifier,
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text(
                "Действующие акции и розыгрыши",
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
private fun CustomerOfferBanner(offer: PublicCustomerOffer, onOpenOffers: () -> Unit) {
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
                    if (isGiveaway) "РОЗЫГРЫШ" else "АКЦИЯ",
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
            Button(
                onClick = onOpenOffers,
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = buttonColor,
                    contentColor = buttonTextColor,
                ),
            ) {
                Text(if (isGiveaway) "Подробнее и участвовать →" else "Подробнее об акции →")
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
