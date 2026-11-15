package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import android.net.Uri
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CustomerOffer
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

internal data class OfferConfirmation(
    val title: String,
    val message: String,
    val action: () -> Any?,
)

@Composable
internal fun AdminOfferCard(
    offer: CustomerOffer,
    token: String,
    busy: Boolean,
    onUploadPrizeImage: (Int, Uri) -> Unit,
    onRemovePrizeImage: (Int) -> Unit,
    onPublish: () -> Unit,
    onDelete: () -> Unit,
    onDraw: () -> Unit,
    onPublishResults: () -> Unit,
) {
    val dateFormatter = remember {
        DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm").withZone(ZoneId.systemDefault())
    }
    fun date(value: String) = runCatching {
        dateFormatter.format(Instant.parse(value))
    }.getOrDefault(value.take(16))

    val isPrizeOffer = offer.type == "GIVEAWAY" || offer.type == "QUIZ"
    val canDraw = isPrizeOffer && offer.drawnAt == null &&
        offer.endsAt.let { runCatching { Instant.parse(it).isBefore(Instant.now()) }.getOrDefault(false) }
    val hasUnpublishedResults = isPrizeOffer && offer.drawnAt != null && offer.resultsPublishedAt == null

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Text(offer.title, fontWeight = FontWeight.Bold, color = UtpInk, fontSize = 16.sp)
            val offerLabel = when (offer.type) {
                "GIVEAWAY" -> "Розыгрыш"
                "QUIZ" -> "Квиз"
                else -> "Акция"
            }
            val publicationLabel = if (offer.isPublished) "Опубликовано" else "Черновик"
            Text("$offerLabel · $publicationLabel", color = UtpBlue, fontSize = 12.sp)
            Text(offer.content, color = UtpMuted, fontSize = 13.sp)
            Text("${date(offer.startsAt)} — ${date(offer.endsAt)}", color = UtpMuted, fontSize = 11.sp)
            if (offer.type == "QUIZ") {
                Text("Вопрос: ${offer.quizQuestion.orEmpty()}", color = UtpInk, fontSize = 13.sp)
                offer.quizOptions.forEachIndexed { index, option ->
                    Text(
                        "${index + 1}. $option${if (offer.quizCorrectOption == index) " ✓ правильный ответ" else ""}",
                        color = UtpMuted,
                        fontSize = 11.sp,
                    )
                }
            }
            if (isPrizeOffer) {
                Text("Участников: ${offer.participantCount}", color = UtpMuted, fontSize = 12.sp)
                listOf(
                    Triple(offer.firstPlacePrize, offer.firstPlacePoints, offer.firstPlacePrizeImageId),
                    Triple(offer.secondPlacePrize, offer.secondPlacePoints, offer.secondPlacePrizeImageId),
                    Triple(offer.thirdPlacePrize, offer.thirdPlacePoints, offer.thirdPlacePrizeImageId),
                ).forEachIndexed { index, reward ->
                    val rewardText = buildString {
                        append("${index + 1}-е место: ${reward.first ?: "приз не указан"}")
                        if (reward.second > 0) append(" · ${reward.second} баллов")
                    }
                    Text(rewardText, color = UtpMuted, fontSize = 11.sp)
                    Row(
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
                    ) {
                        reward.third?.let { objectId ->
                            RemoteProjectImage(
                                objectId = objectId,
                                token = token,
                                modifier = Modifier.size(64.dp),
                                contentDescription = "Фото приза за ${index + 1}-е место",
                            )
                        }
                        PhotoPickerButton(
                            label = if (reward.third == null) "Добавить фото" else "Заменить фото",
                            enabled = !busy,
                            onImageSelected = { onUploadPrizeImage(index + 1, it) },
                        )
                        if (reward.third != null) {
                            TextButton(
                                onClick = { onRemovePrizeImage(index + 1) },
                                enabled = !busy,
                            ) { Text("Удалить") }
                        }
                    }
                }
                if (offer.drawnAt != null) {
                    val resultsLabel = if (offer.resultsPublishedAt != null) " · результаты опубликованы" else ""
                    Text("Победители выбраны$resultsLabel", color = UtpBlue, fontSize = 11.sp)
                }
                offer.winners.forEach { winner ->
                    val winnerText = buildString {
                        append("${winner.place}. ${winner.displayName}")
                        winner.prize?.let { append(" — $it") }
                        if (winner.bonusPoints > 0) append(" · ${winner.bonusPoints} баллов")
                    }
                    Text(winnerText, color = UtpMuted, fontSize = 11.sp)
                }
                if (offer.type == "QUIZ" && offer.resultsPublishedAt != null && offer.winners.isEmpty()) {
                    Text("Нет правильно ответивших участников.", color = UtpMuted, fontSize = 11.sp)
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedButton(onClick = onPublish, enabled = !busy) {
                    Text(if (offer.isPublished) "Снять" else "Опубликовать")
                }
                TextButton(onClick = onDelete, enabled = !busy) { Text("Удалить") }
            }
            if (canDraw) {
                Button(
                    onClick = onDraw,
                    enabled = !busy && (offer.type == "QUIZ" || offer.participantCount >= 3),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (offer.type == "QUIZ") "Выбрать победителей по правильным ответам" else "Выбрать победителей")
                }
            }
            if (hasUnpublishedResults) {
                Button(
                    onClick = onPublishResults,
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Опубликовать результаты")
                }
            }
        }
    }
}
