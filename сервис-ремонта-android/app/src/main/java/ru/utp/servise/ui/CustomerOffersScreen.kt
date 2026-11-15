package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
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
    token: String,
    offers: List<CustomerOffer>,
    busy: Boolean,
    onParticipate: (String, Int?) -> Unit,
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
    val hasPublishedQuiz = visibleOffers.any { it.type == "QUIZ" }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(UtpPale)
            .verticalScroll(rememberScrollState())
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Акции, розыгрыши и квизы", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            "Участвуйте в предложениях сервиса и следите за опубликованными результатами.",
            fontSize = 13.sp,
            color = UtpMuted,
            lineHeight = 19.sp,
        )

        if (visibleOffers.isEmpty()) {
            Text("Пока нет опубликованных акций, розыгрышей и квизов.", color = UtpMuted)
        }
        if (!hasPublishedQuiz) {
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(20.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Квиз в разработке 👨‍💻", fontSize = 17.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                    Text(
                        "Готовим первый вопрос о правильном уходе за компьютерами и ноутбуками.",
                        fontSize = 13.sp,
                        color = UtpMuted,
                        lineHeight = 19.sp,
                    )
                }
            }
        }

        visibleOffers.forEach { offer ->
            key(offer.id) {
                CustomerOfferCard(
                    offer = offer,
                    token = token,
                    currentTimeMillis = currentTimeMillis,
                    busy = busy,
                    onParticipate = { answerIndex -> onParticipate(offer.id, answerIndex) },
                )
            }
        }
    }
}

@Composable
private fun CustomerOfferCard(
    offer: CustomerOffer,
    token: String,
    currentTimeMillis: Long,
    busy: Boolean,
    onParticipate: (Int?) -> Unit,
) {
    var selectedOption by remember(offer.id) { mutableStateOf(offer.myParticipation?.answerIndex) }
    val startsAt = offerTime(offer.startsAt)
    val endsAt = offerTime(offer.endsAt)
    val isUpcoming = currentTimeMillis < startsAt
    val isActive = currentTimeMillis >= startsAt && currentTimeMillis < endsAt
    val isQuiz = offer.type == "QUIZ"
    val isGiveaway = offer.type == "GIVEAWAY"
    val hasJoined = offer.myParticipation != null
    val resultsArePublished = offer.resultsPublishedAt != null
    val answerIndex = offer.myParticipation?.answerIndex ?: selectedOption

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
                when {
                    isQuiz -> "Квиз"
                    isGiveaway -> "Розыгрыш"
                    else -> "Акция"
                },
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

            if (isQuiz) {
                QuizAnswerOptions(
                    offer = offer,
                    selectedIndex = answerIndex,
                    enabled = !hasJoined && isActive,
                    resultsArePublished = resultsArePublished,
                    onSelect = { selectedOption = it },
                )
                if (hasJoined && resultsArePublished) {
                    Text(
                        if (offer.myParticipation?.answerCorrect == true) {
                            "Вы ответили правильно — участвуете в розыгрыше."
                        } else {
                            "Ваш ответ был неверным. Спасибо за участие!"
                        },
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Medium,
                        color = UtpBlue,
                    )
                }
            }

            if (isGiveaway || isQuiz) {
                OfferPrizes(offer, token)
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
                resultsArePublished -> {
                    if (isQuiz && offer.winners.isEmpty()) {
                        Text("В этот раз победителей нет.", fontSize = 13.sp, color = UtpMuted)
                    }
                    PublishedPodium(offer.winners, offer.myParticipation?.place)
                }
                offer.drawnAt != null -> Text(
                    "Розыгрыш проведён. Ожидайте публикации результатов.",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = UtpMuted,
                )
                hasJoined -> Text(
                    if (isQuiz) "Ответ принят. Повторная попытка не предусмотрена."
                    else if (isActive) "Вы участвуете. Удачи!" else "Вы зарегистрированы для участия.",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpBlue,
                )
                isUpcoming -> Text("Участие откроется в указанное время.", fontSize = 12.sp, color = UtpMuted)
                isActive -> Button(
                    onClick = { onParticipate(if (isQuiz) answerIndex else null) },
                    enabled = !busy && (!isQuiz || answerIndex != null),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(
                        when {
                            busy -> "Подождите…"
                            isQuiz -> "Ответить и участвовать"
                            else -> "Участвовать"
                        },
                    )
                }
                else -> Text("Приём участников завершён.", fontSize = 12.sp, color = UtpMuted)
            }
        }
    }
}

@Composable
private fun QuizAnswerOptions(
    offer: CustomerOffer,
    selectedIndex: Int?,
    enabled: Boolean,
    resultsArePublished: Boolean,
    onSelect: (Int) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(offer.quizQuestion.orEmpty(), fontSize = 15.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
        offer.quizOptions.forEachIndexed { index, option ->
            val isCorrect = resultsArePublished && offer.quizCorrectOption == index
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .selectable(
                        selected = selectedIndex == index,
                        enabled = enabled,
                        role = Role.RadioButton,
                        onClick = { onSelect(index) },
                    )
                    .padding(vertical = 3.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                RadioButton(
                    selected = selectedIndex == index,
                    onClick = null,
                    enabled = enabled,
                )
                Text(
                    text = if (isCorrect) "$option  ✓" else option,
                    modifier = Modifier.weight(1f),
                    fontSize = 13.sp,
                    color = if (isCorrect) UtpBlue else UtpInk,
                )
            }
        }
        if (resultsArePublished) {
            Text("Правильный вариант отмечен галочкой.", fontSize = 11.sp, color = UtpMuted)
        }
    }
}

private data class OfferPrizeDisplay(
    val place: String,
    val prize: String?,
    val points: Int,
    val imageObjectId: String?,
)

@Composable
private fun OfferPrizes(offer: CustomerOffer, token: String) {
    val prizes = listOf(
        OfferPrizeDisplay("1 место", offer.firstPlacePrize, offer.firstPlacePoints, offer.firstPlacePrizeImageId),
        OfferPrizeDisplay("2 место", offer.secondPlacePrize, offer.secondPlacePoints, offer.secondPlacePrizeImageId),
        OfferPrizeDisplay("3 место", offer.thirdPlacePrize, offer.thirdPlacePoints, offer.thirdPlacePrizeImageId),
    ).filter { !it.prize.isNullOrBlank() || it.points > 0 || it.imageObjectId != null }

    if (prizes.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("Призы", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            prizes.forEach { reward ->
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    reward.imageObjectId?.let { objectId ->
                        RemoteProjectImage(
                            objectId = objectId,
                            token = token,
                            modifier = Modifier.size(72.dp),
                            contentDescription = "Фото приза за ${reward.place}",
                        )
                    }
                    Text(
                        listOfNotNull(
                            "${reward.place}: ${reward.prize?.takeIf(String::isNotBlank)}".takeIf {
                                !reward.prize.isNullOrBlank()
                            },
                            "${reward.points} баллов".takeIf { reward.points > 0 },
                        ).joinToString(" · "),
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                }
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
