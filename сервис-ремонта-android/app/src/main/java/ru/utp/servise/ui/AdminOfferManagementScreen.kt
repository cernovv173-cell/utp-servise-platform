package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.AdminMarketingApi
import ru.utp.servise.data.CustomerOffer
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

private data class OfferConfirmation(
    val title: String,
    val message: String,
    val action: () -> Any?,
)

@Composable
fun AdminOfferManagementScreen(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var offers by remember { mutableStateOf(emptyList<CustomerOffer>()) }
    var loading by remember { mutableStateOf(true) }
    var offerType by remember { mutableStateOf("PROMOTION") }
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var startsAt by remember { mutableStateOf(Instant.now().toString()) }
    var endsAt by remember { mutableStateOf(Instant.now().plusSeconds(7 * 24 * 60 * 60L).toString()) }
    var prizes by remember { mutableStateOf(listOf("", "", "")) }
    var points by remember { mutableStateOf(listOf("0", "0", "0")) }
    var confirmation by remember { mutableStateOf<OfferConfirmation?>(null) }

    fun reload() {
        scope.launch {
            loading = true
            try {
                offers = withContext(Dispatchers.IO) { AdminMarketingApi.offers(token) }
            } catch (failure: Throwable) {
                onError(failure.message ?: "Не удалось загрузить акции.")
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(token) { reload() }

    val rewardPoints = points.map { it.toIntOrNull() ?: 0 }
    val validDates = runCatching {
        Instant.parse(endsAt).isAfter(Instant.parse(startsAt))
    }.getOrDefault(false)
    val validRewards = offerType != "GIVEAWAY" || (0..2).all { index ->
        rewardPoints[index] in 0..100_000 && (prizes[index].isNotBlank() || rewardPoints[index] > 0)
    }
    val canCreate = !busy && title.trim().length >= 2 && content.isNotBlank() && validDates && validRewards

    fun clearDraft() {
        title = ""
        content = ""
        offerType = "PROMOTION"
        startsAt = Instant.now().toString()
        endsAt = Instant.now().plusSeconds(7 * 24 * 60 * 60L).toString()
        prizes = listOf("", "", "")
        points = listOf("0", "0", "0")
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text("←  Управление") }
            Text("Акции и розыгрыши", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Text(
                "Черновики; публикация отправляет уведомление клиентам.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
        }
        item {
            Card(
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(
                    containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
                ),
            ) {
                Column(
                    Modifier.fillMaxWidth().padding(14.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    Text("Новое предложение", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        if (offerType == "PROMOTION") {
                            Button(onClick = {}, modifier = Modifier.weight(1f)) { Text("Акция") }
                        } else {
                            OutlinedButton(
                                onClick = { offerType = "PROMOTION" },
                                modifier = Modifier.weight(1f),
                            ) { Text("Акция") }
                        }
                        if (offerType == "GIVEAWAY") {
                            Button(onClick = {}, modifier = Modifier.weight(1f)) { Text("Розыгрыш") }
                        } else {
                            OutlinedButton(
                                onClick = { offerType = "GIVEAWAY" },
                                modifier = Modifier.weight(1f),
                            ) { Text("Розыгрыш") }
                        }
                    }
                    OutlinedTextField(
                        value = title,
                        onValueChange = { title = it.take(160) },
                        label = { Text("Заголовок") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = content,
                        onValueChange = { content = it.take(8000) },
                        label = { Text("Описание") },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 3,
                        maxLines = 7,
                        shape = RoundedCornerShape(12.dp),
                    )
                    ScheduleDateTimeField(
                        "Начало",
                        startsAt,
                        { startsAt = it.orEmpty() },
                    )
                    ScheduleDateTimeField(
                        "Окончание",
                        endsAt,
                        { endsAt = it.orEmpty() },
                    )
                    if (!validDates) {
                        Text(
                            "Дата окончания должна быть позже даты начала.",
                            color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                            fontSize = 12.sp,
                        )
                    }
                    if (offerType == "GIVEAWAY") {
                        Text(
                            "Награды для трёх мест",
                            fontWeight = FontWeight.SemiBold,
                            color = UtpInk,
                        )
                        (0..2).forEach { index ->
                            Text(
                                "${index + 1}-е место",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Medium,
                                color = UtpMuted,
                            )
                            OutlinedTextField(
                                value = prizes[index],
                                onValueChange = { value ->
                                    prizes = prizes.toMutableList().also { it[index] = value.take(500) }
                                },
                                label = { Text("Приз") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                            )
                            OutlinedTextField(
                                value = points[index],
                                onValueChange = { value ->
                                    if (value.all(Char::isDigit) && value.length <= 6) {
                                        points = points.toMutableList().also { it[index] = value }
                                    }
                                },
                                label = { Text("Баллы (0–100000)") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                            )
                        }
                        if (!validRewards) {
                            Text(
                                "Для каждого места укажите приз или баллы.",
                                color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                                fontSize = 12.sp,
                            )
                        }
                    }
                    Button(
                        onClick = {
                            val prizeValues = (0..2).map { index ->
                                prizes[index].trim().takeIf(String::isNotEmpty) to rewardPoints[index]
                            }
                            runAction({
                                AdminMarketingApi.createOffer(
                                    token = token,
                                    type = offerType,
                                    title = title,
                                    content = content,
                                    prizes = if (offerType == "GIVEAWAY") {
                                        prizeValues
                                    } else {
                                        List(3) { null to 0 }
                                    },
                                    startsAt = startsAt,
                                    endsAt = endsAt,
                                )
                            }) {
                                clearDraft()
                                reload()
                            }
                        },
                        enabled = canCreate,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Сохранить черновик") }
                }
            }
        }
        item {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(
                    "Существующие предложения",
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
                TextButton(onClick = ::reload, enabled = !loading && !busy) { Text("Обновить") }
            }
            if (loading) Text("Загрузка…", color = UtpMuted)
            else if (offers.isEmpty()) Text("Пока нет акций и розыгрышей.", color = UtpMuted)
        }
        items(offers, key = { it.id }) { offer ->
            AdminOfferCard(
                offer = offer,
                busy = busy,
                onPublish = {
                    val nextPublished = !offer.isPublished
                    confirmation = OfferConfirmation(
                        title = if (nextPublished) {
                            "Опубликовать предложение?"
                        } else {
                            "Снять с публикации?"
                        },
                        message = if (nextPublished) {
                            "Публикация покажет предложение клиентам " +
                                "и отправит уведомление."
                        } else {
                            "Предложение перестанет отображаться клиентам."
                        },
                        action = {
                            AdminMarketingApi.setOfferPublished(token, offer.id, nextPublished)
                        },
                    )
                },
                onDelete = {
                    confirmation = OfferConfirmation(
                        "Удалить предложение?",
                        "Это действие нельзя отменить.",
                        { AdminMarketingApi.deleteOffer(token, offer.id) },
                    )
                },
                onDraw = {
                    confirmation = OfferConfirmation(
                        "Выбрать победителей?",
                        "После жеребьёвки победителей нельзя поменять.",
                        { AdminMarketingApi.drawOffer(token, offer.id) },
                    )
                },
                onPublishResults = {
                    confirmation = OfferConfirmation(
                        "Опубликовать результаты?",
                        "Победители увидят результаты; " +
                            "баллы начислятся автоматически.",
                        { AdminMarketingApi.publishOfferResults(token, offer.id) },
                    )
                },
            )
        }
    }

    confirmation?.let { pending ->
        AlertDialog(
            onDismissRequest = { confirmation = null },
            title = { Text(pending.title) },
            text = { Text(pending.message) },
            confirmButton = {
                TextButton(onClick = {
                    confirmation = null
                    runAction({ pending.action() }) { reload() }
                }, enabled = !busy) { Text("Подтвердить") }
            },
            dismissButton = {
                TextButton(onClick = { confirmation = null }) { Text("Отмена") }
            },
        )
    }
}

@Composable
private fun AdminOfferCard(
    offer: CustomerOffer,
    busy: Boolean,
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
    val canDraw = offer.type == "GIVEAWAY" && offer.drawnAt == null &&
        offer.endsAt.let { runCatching { Instant.parse(it).isBefore(Instant.now()) }.getOrDefault(false) }
    val hasUnpublishedResults = offer.type == "GIVEAWAY" &&
        offer.drawnAt != null && offer.resultsPublishedAt == null

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
            val offerLabel = if (offer.type == "GIVEAWAY") "Розыгрыш" else "Акция"
            val publicationLabel = if (offer.isPublished) "Опубликовано" else "Черновик"
            Text("$offerLabel · $publicationLabel", color = UtpBlue, fontSize = 12.sp)
            Text(offer.content, color = UtpMuted, fontSize = 13.sp)
            Text("${date(offer.startsAt)} — ${date(offer.endsAt)}", color = UtpMuted, fontSize = 11.sp)
            if (offer.type == "GIVEAWAY") {
                Text("Участников: ${offer.participantCount}", color = UtpMuted, fontSize = 12.sp)
                listOf(
                    offer.firstPlacePrize to offer.firstPlacePoints,
                    offer.secondPlacePrize to offer.secondPlacePoints,
                    offer.thirdPlacePrize to offer.thirdPlacePoints,
                ).forEachIndexed { index, reward ->
                    val rewardText = buildString {
                        append("${index + 1}-е место: ${reward.first ?: "приз не указан"}")
                        if (reward.second > 0) append(" · ${reward.second} баллов")
                    }
                    Text(rewardText, color = UtpMuted, fontSize = 11.sp)
                }
                if (offer.drawnAt != null) {
                    val resultsLabel = if (offer.resultsPublishedAt != null) {
                        " · результаты опубликованы"
                    } else {
                        ""
                    }
                    Text(
                        "Победители выбраны$resultsLabel",
                        color = UtpBlue,
                        fontSize = 11.sp,
                    )
                }
                offer.winners.forEach { winner ->
                    val winnerText = buildString {
                        append("${winner.place}. ${winner.displayName}")
                        winner.prize?.let { append(" — $it") }
                        if (winner.bonusPoints > 0) append(" · ${winner.bonusPoints} баллов")
                    }
                    Text(winnerText, color = UtpMuted, fontSize = 11.sp)
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
                    enabled = !busy && offer.participantCount >= 3,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text("Выбрать победителей")
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
