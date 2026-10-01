package ru.utp.servise.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.deviceLabel

typealias RunAction = (suspend () -> Any?, (Any?) -> Unit) -> Unit

@Composable
fun RepairOrdersScreen(
    title: String,
    orders: List<RepairOrder>,
    role: String,
    token: String,
    technicians: List<StaffMember>,
    catalogItems: List<CatalogItem>,
    historyOnly: Boolean,
    runAction: RunAction,
    refresh: () -> Unit,
    onChat: (String) -> Unit = {},
    onReview: (String) -> Unit,
    loyaltyBalance: Int = 0,
) {
    var searchText by remember { mutableStateOf("") }
    var searchResults by remember { mutableStateOf<List<RepairOrder>?>(null) }
    val visibleOrders = if (historyOnly) {
        orders.filter { it.status == "COMPLETED" || it.status == "CANCELLED" }
    } else {
        orders.filter { it.status != "COMPLETED" && it.status != "CANCELLED" }
    }
    val displayedOrders = searchResults ?: visibleOrders
    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState())
            .padding(horizontal = 18.dp, vertical = 14.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("${visibleOrders.size} заявок", fontSize = 12.sp, color = UtpMuted)
            }
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        if (role == "ADMIN") {
            OutlinedTextField(
                value = searchText,
                onValueChange = { searchText = it; searchResults = null },
                label = { Text("Поиск по сервисному номеру") },
                placeholder = { Text("Например, SRV-2026-000001") },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
            )
            OutlinedButton(
                onClick = {
                    runAction({ ApiClient.searchOrders(token, searchText) }) { result ->
                        searchResults = (result as? List<*>)
                            ?.filterIsInstance<RepairOrder>()
                            ?: emptyList()
                    }
                },
                enabled = searchText.trim().length >= 2,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Найти заявку") }
        }
        if (displayedOrders.isEmpty()) {
            Card(
                modifier = Modifier.padding(top = 10.dp),
                shape = RoundedCornerShape(18.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Text(
                    if (historyOnly) "Завершённых ремонтов пока нет." else "Сейчас здесь нет заявок.",
                    Modifier.padding(18.dp),
                    color = UtpMuted,
                )
            }
        }
        displayedOrders.forEach { order ->
            RepairOrderCard(order, role, token, technicians, catalogItems, runAction, onChat, onReview, loyaltyBalance)
        }
    }
}

@Composable
fun ReviewFormScreen(orderId: String, token: String, runAction: RunAction, onDone: () -> Unit) {
    var rating by remember { mutableStateOf(5) }
    var comment by remember { mutableStateOf("") }
    var imageUri by remember { mutableStateOf<Uri?>(null) }
    val context = LocalContext.current
    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState())
            .padding(20.dp),
    ) {
        Text("Отзыв о ремонте", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Оцените завершённый заказ", color = UtpMuted, modifier = Modifier.padding(top = 5.dp, bottom = 12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            (1..5).forEach { value ->
                TextButton(onClick = { rating = value }) {
                    Text(if (value <= rating) "★" else "☆", fontSize = 25.sp, color = UtpBlue)
                }
            }
        }
        OutlinedTextField(
            comment,
            { comment = it },
            label = { Text("Комментарий") },
            modifier = Modifier.fillMaxWidth().height(145.dp),
            shape = RoundedCornerShape(14.dp),
        )
        PhotoPickerButton(if (imageUri == null) "Добавить фотографию" else "Изменить фотографию") { imageUri = it }
        imageUri?.let { Text("Фотография добавлена", fontSize = 12.sp, color = UtpMuted) }
        Button(
            onClick = {
                runAction({
                    ApiClient.createReview(
                        token,
                        orderId,
                        rating,
                        comment.trim(),
                        imageUri?.let { compressSelectedImage(context, it) },
                    )
                }) { onDone() }
            },
            modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
            enabled = comment.trim().length >= 3,
            shape = RoundedCornerShape(13.dp),
        ) { Text("Опубликовать отзыв") }
    }
}

@Composable
fun ReviewsScreen(
    title: String,
    reviews: List<CustomerReview>,
    refresh: () -> Unit,
    token: String? = null,
    canModerate: Boolean = false,
    runAction: RunAction? = null,
) {
    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState())
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk, modifier = Modifier.weight(1f))
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        Text("${reviews.size} отзывов", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(bottom = 10.dp))
        if (reviews.isEmpty()) Text("Отзывов пока нет.", color = UtpMuted)
        reviews.forEach { review ->
            Card(
                Modifier.fillMaxWidth().padding(bottom = 10.dp),
                shape = RoundedCornerShape(17.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(15.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("★ ${review.rating}/5", fontWeight = FontWeight.Bold, color = UtpBlue, modifier = Modifier.weight(1f))
                        Text(review.deviceType.deviceLabel(), fontSize = 12.sp, color = UtpMuted)
                    }
                    Text(review.comment, fontSize = 14.sp, color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                    review.imageObjectId?.let { image ->
                        RemoteProjectImage(image, token.orEmpty(), Modifier.fillMaxWidth().height(170.dp).padding(top = 8.dp), "Фотография к отзыву")
                    }
                    Text(if (review.isPublished) "Опубликован" else "Ожидает модерации", fontSize = 11.sp, color = if (review.isPublished) UtpBlue else UtpMuted, modifier = Modifier.padding(top = 6.dp))
                    Text(
                        "${review.customerName}${review.technicianName.takeIf { it.isNotBlank() }?.let { " · Мастер: $it" }.orEmpty()}",
                        fontSize = 11.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 9.dp),
                    )
                    if (canModerate && runAction != null) {
                        OutlinedButton(
                            onClick = { runAction({ ApiClient.moderateReview(token.orEmpty(), review.id, !review.isPublished) }, {}) },
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        ) { Text(if (review.isPublished) "Снять с публикации" else "Одобрить публикацию") }
                    }
                }
            }
        }
    }
}
