package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.utp.servise.data.CustomerOffer
import ru.utp.servise.data.CustomerOfferWinner
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun CustomerOffersScreen(
    offers: List<CustomerOffer>,
    busy: Boolean,
    onParticipate: (String) -> Unit,
) {
    var currentTimeMillis by remember { mutableLongStateOf(System.currentTimeMillis()) }
    LaunchedEffect(Unit) {
        while (true) {
            delay(60_000)
            currentTimeMillis = System.currentTimeMillis()
        }
    }

    val visibleOffers = offers.sortedWith(
        compareBy<CustomerOffer> {
            when {
                currentTimeMillis < offerTime(it.startsAt) -> 1
                currentTimeMillis < offerTime(it.endsAt) -> 0
                else -> 2
            }
        }.thenBy { offerTime(it.startsAt) },
    )

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Акции и розыгрыши", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            "Участвуйте в предложениях сервиса и следите за опубликованными результатами.",
            fontSize = 13.sp,
            color = UtpMuted,
            lineHeight = 19.sp,
        )

        if (visibleOffers.isEmpty()) {
            Text("Пока нет опубликованных акций и розыгрышей.", color = UtpMuted)
        }

        visibleOffers.forEach { offer ->
            val startsAt = offerTime(offer.startsAt)
            val endsAt = offerTime(offer.endsAt)
            val isUpcoming = currentTimeMillis < startsAt
            val isActive = currentTimeMillis >= startsAt && currentTimeMillis < endsAt
            val resultsArePublished = offer.resultsPublishedAt != null

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(
                    modifier = Modifier.padding(16.dp),
                    verticalArrangement = Arrangement.spacedBy(9.dp),
                ) {
                    Text(
                        if (offer.type == "GIVEAWAY") "Розыгрыш" else "Акция",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpBlue,
                    )
                    Text(offer.title, fontSize = 19.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                    if (offer.content.isNotBlank()) {
                        Text(offer.content, fontSize = 13.sp, color = UtpMuted, lineHeight = 19.sp)
                    }
                    Text(
                        "${formatOfferDate(offer.startsAt)} — ${formatOfferDate(offer.endsAt)}",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )

                    if (offer.type == "GIVEAWAY") {
                        OfferPrizes(offer)
                        Text("Участников: ${offer.participantCount}", fontSize = 12.sp, color = UtpMuted)
                    } else {
                        Text(
                            "Участие в акции не меняет стоимость заказа автоматически.",
                            fontSize = 12.sp,
                            color = UtpMuted,
                            lineHeight = 17.sp,
                        )
                    }

                    when {
                        resultsArePublished -> PublishedPodium(offer.winners, offer.myParticipation?.place)
                        offer.drawnAt != null -> Text(
                            "Розыгрыш проведён. Ожидайте публикации результатов.",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Medium,
                            color = UtpMuted,
                        )
                        offer.myParticipation != null -> Text(
                            if (isActive) "Вы участвуете. Удачи!" else "Вы зарегистрированы для участия.",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = UtpBlue,
                        )
                        isUpcoming -> Text("Участие откроется в указанное время.", fontSize = 12.sp, color = UtpMuted)
                        isActive -> Button(
                            onClick = { onParticipate(offer.id) },
                            enabled = !busy,
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(14.dp),
                        ) {
                            Text(if (busy) "Подождите…" else "Участвовать")
                        }
                        else -> Text("Приём участников завершён.", fontSize = 12.sp, color = UtpMuted)
                    }
                }
            }
        }
    }
}

@Composable
private fun OfferPrizes(offer: CustomerOffer) {
    val prizes = listOf(
        Triple("1 место", offer.firstPlacePrize, offer.firstPlacePoints),
        Triple("2 место", offer.secondPlacePrize, offer.secondPlacePoints),
        Triple("3 место", offer.thirdPlacePrize, offer.thirdPlacePoints),
    ).filter { (_, prize, points) -> !prize.isNullOrBlank() || points > 0 }

    if (prizes.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("Призы", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            prizes.forEach { (place, prize, points) ->
                Text(
                    listOfNotNull(
                        "$place: ${prize?.takeIf(String::isNotBlank)}".takeIf { !prize.isNullOrBlank() },
                        "$points баллов".takeIf { points > 0 },
                    ).joinToString(" · "),
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
            }
        }
    }
}

@Composable
private fun PublishedPodium(winners: List<CustomerOfferWinner>, myPlace: Int?) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = UtpPale),
    ) {
        Column(
            modifier = Modifier.padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Победители", fontSize = 15.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            winners.sortedBy { it.place }.forEach { winner ->
                val place = when (winner.place) {
                    1 -> "1 место"
                    2 -> "2 место"
                    else -> "3 место"
                }
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            "$place${if (myPlace == winner.place) " · вы" else ""}",
                            fontWeight = FontWeight.SemiBold,
                            color = UtpInk,
                        )
                        Text(winner.displayName, fontSize = 12.sp, color = UtpMuted)
                    }
                    Column(horizontalAlignment = Alignment.End) {
                        winner.prize?.takeIf(String::isNotBlank)?.let {
                            Text(it, fontSize = 12.sp, fontWeight = FontWeight.Medium, color = UtpInk)
                        }
                        if (winner.bonusPoints > 0) {
                            Text("+${winner.bonusPoints} баллов", fontSize = 11.sp, color = UtpBlue)
                        }
                    }
                }
            }
            if (winners.isEmpty()) {
                Text("Опубликованные победители появятся здесь.", fontSize = 12.sp, color = UtpMuted)
            }
        }
    }
}

private fun offerTime(value: String): Long =
    runCatching { Instant.parse(value).toEpochMilli() }.getOrDefault(Long.MAX_VALUE)

private fun formatOfferDate(value: String): String =
    runCatching {
        Instant.parse(value)
            .atZone(ZoneId.systemDefault())
            .format(DateTimeFormatter.ofPattern("d MMM yyyy, HH:mm", Locale.forLanguageTag("ru")))
    }.getOrDefault(value.take(16).replace('T', ' '))
