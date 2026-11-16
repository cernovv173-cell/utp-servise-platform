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
import androidx.compose.material3.RadioButton
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
import androidx.compose.ui.platform.LocalContext
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
import android.net.Uri

private data class OfferCreateOutcome(val photoUploadFailed: Boolean)

@Composable
fun AdminOfferManagementScreen(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current
    var offers by remember { mutableStateOf(emptyList<CustomerOffer>()) }
    var loading by remember { mutableStateOf(true) }
    var offerType by remember { mutableStateOf("PROMOTION") }
    var title by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }
    var startsAt by remember { mutableStateOf(Instant.now().toString()) }
    var endsAt by remember { mutableStateOf(Instant.now().plusSeconds(7 * 24 * 60 * 60L).toString()) }
    var prizes by remember { mutableStateOf(listOf("", "", "")) }
    var points by remember { mutableStateOf(listOf("0", "0", "0")) }
    var prizePhotoUris by remember { mutableStateOf<List<Uri?>>(listOf(null, null, null)) }
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
    val configuredRewardPlaces = (0..2).map { index ->
        prizes[index].isNotBlank() || rewardPoints[index] > 0
    }
    val validRewards = offerType != "GIVEAWAY" || (
        rewardPoints.all { it in 0..100_000 } &&
            configuredRewardPlaces[0] &&
            !(configuredRewardPlaces[2] && !configuredRewardPlaces[1])
        )
    val canCreate = !busy && title.trim().length >= 2 && content.isNotBlank() &&
        validDates && validRewards

    fun chooseOfferType(next: String) {
        offerType = next
    }

    fun clearDraft() {
        title = ""
        content = ""
        offerType = "PROMOTION"
        startsAt = Instant.now().toString()
        endsAt = Instant.now().plusSeconds(7 * 24 * 60 * 60L).toString()
        prizes = listOf("", "", "")
        points = listOf("0", "0", "0")
        prizePhotoUris = listOf(null, null, null)
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
                        listOf("GIVEAWAY" to "Розыгрыш", "PROMOTION" to "Акция")
                            .forEach { (value, label) ->
                                if (offerType == value) {
                                    Button(onClick = {}, modifier = Modifier.weight(1f)) { Text(label) }
                                } else {
                                    OutlinedButton(
                                        onClick = { chooseOfferType(value) },
                                        modifier = Modifier.weight(1f),
                                    ) { Text(label) }
                                }
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
                            "Награды (от 1 до 3 мест)",
                            fontWeight = FontWeight.SemiBold,
                            color = UtpInk,
                        )
                        Text(
                            "Укажите награду для 1-го места. 2-е и 3-е можно оставить пустыми; если добавляете 3-е, заполните 2-е. Фото приза необязательно.",
                            color = UtpMuted,
                            fontSize = 12.sp,
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
                                label = { Text("Приз (необязательно)") },
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
                                label = { Text("Баллы (необязательно, 0–100000)") },
                                singleLine = true,
                                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                                modifier = Modifier.fillMaxWidth(),
                                shape = RoundedCornerShape(12.dp),
                            )
                            PhotoPickerButton(
                                label = if (prizePhotoUris[index] == null) {
                                    "Добавить фото (необязательно)"
                                } else {
                                    "Заменить фото приза"
                                },
                                enabled = !busy,
                            ) { uri ->
                                prizePhotoUris = prizePhotoUris.toMutableList().also {
                                    it[index] = uri
                                }
                            }
                            prizePhotoUris[index]?.let { uri ->
                                Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                                    Text(
                                        uri.lastPathSegment?.takeLast(40) ?: "Фото выбрано",
                                        modifier = Modifier.weight(1f),
                                        fontSize = 11.sp,
                                        color = UtpMuted,
                                    )
                                    TextButton(
                                        onClick = {
                                            prizePhotoUris = prizePhotoUris.toMutableList().also {
                                                it[index] = null
                                            }
                                        },
                                    ) { Text("Убрать") }
                                }
                            }
                        }
                        if (!validRewards) {
                            Text(
                                "Добавьте приз и/или баллы для 1-го места; места заполняются по порядку.",
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
                                val offer = AdminMarketingApi.createOffer(
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
                                var photoUploadFailed = false
                                for (index in prizePhotoUris.indices) {
                                    val uri = prizePhotoUris[index] ?: continue
                                    try {
                                        withContext(Dispatchers.IO) {
                                            val image = compressSelectedImage(context, uri)
                                            AdminMarketingApi.uploadOfferPrizeImage(
                                                token,
                                                offer.id,
                                                index + 1,
                                                image,
                                            )
                                        }
                                    } catch (_: Throwable) {
                                        photoUploadFailed = true
                                        break
                                    }
                                }
                                OfferCreateOutcome(photoUploadFailed)
                            }) {
                                val outcome = it as? OfferCreateOutcome
                                clearDraft()
                                reload()
                                if (outcome?.photoUploadFailed == true) {
                                    onError("Черновик сохранён, но фото не загрузились. Добавьте их в списке предложений.")
                                }
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
                token = token,
                busy = busy,
                onUploadPrizeImage = { place, uri ->
                    runAction({
                        withContext(Dispatchers.IO) {
                            AdminMarketingApi.uploadOfferPrizeImage(
                                token,
                                offer.id,
                                place,
                                compressSelectedImage(context, uri),
                            )
                        }
                    }) { reload() }
                },
                onRemovePrizeImage = { place ->
                    runAction({
                        withContext(Dispatchers.IO) {
                            AdminMarketingApi.deleteOfferPrizeImage(token, offer.id, place)
                        }
                    }) { reload() }
                },
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

