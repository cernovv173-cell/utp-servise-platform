package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.TextFieldValue
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.delay
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CraftItem
import ru.utp.servise.data.CraftOrderChat
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.SiteBanner

@Composable
fun CraftsScreen(
    token: String,
    isAdmin: Boolean,
    items: List<CraftItem>,
    orders: List<CraftOrder>,
    staff: List<StaffMember>,
    runAction: RunAction,
    refresh: () -> Unit,
    onBack: () -> Unit,
    banners: List<SiteBanner> = emptyList(),
    onCampaignNavigate: (String) -> Unit = {},
    embedded: Boolean = false,
    onAddToShopCart: (CraftItem) -> Unit = {},
) {
    var customTitle by remember { mutableStateOf("") }
    var customNote by remember { mutableStateOf("") }
    var customQuantity by remember { mutableStateOf("1") }
    val contentModifier = if (embedded) {
        Modifier.fillMaxWidth()
    } else {
        Modifier.fillMaxSize().verticalScroll(rememberScrollState())
    }
    Column(
        contentModifier.background(UtpPale).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        if (!embedded) TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Рукоделия", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Изделия ручной работы: готовые — в корзину, уникальные — обсудим и изготовим.", fontSize = 13.sp, color = UtpMuted)
        if (!isAdmin) {
            CampaignBannerCarousel(
                banners = banners,
                placement = "CRAFTS",
                token = token,
                onNavigate = onCampaignNavigate,
            )
        }

        if (isAdmin) {
            CraftItemManagementScreen(token, items, runAction, refresh)
            Text("Заявки на изделия", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            orders.forEach { order -> AdminCraftOrderCard(order, token, staff, runAction, refresh) }
        } else {
            items.filter { it.isPublished }.forEach { item ->
                CustomerCraftItemCard(item, token, runAction, refresh, onAddToShopCart)
            }
            Spacer(Modifier.height(4.dp))
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("Индивидуальный заказ", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    OutlinedTextField(customTitle, { customTitle = it.take(160) }, label = { Text("Что изготовить") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                    OutlinedTextField(customNote, { customNote = it.take(2000) }, label = { Text("Описание и пожелания") }, modifier = Modifier.fillMaxWidth(), minLines = 3, shape = RoundedCornerShape(12.dp))
                    OutlinedTextField(customQuantity, { customQuantity = it.filter(Char::isDigit).take(2) }, label = { Text("Количество") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                    Button(
                        onClick = { runAction({ ApiClient.createCraftOrder(token, null, customTitle.trim(), customQuantity.toIntOrNull()?.coerceIn(1, 99) ?: 1, customNote.trim()) }) { customTitle = ""; customNote = ""; refresh() } },
                        enabled = customTitle.trim().length >= 2 && customNote.trim().length >= 2,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Отправить заявку") }
                    Text("Цена и срок изготовления уточняются отдельно. Доставку согласуем после готовности изделия; онлайн-оплаты нет.", fontSize = 11.sp, color = UtpMuted)
                }
            }
            Text("Мои заявки", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            orders.forEach { CustomerCraftOrderCard(it, token, runAction, refresh) }
        }
        if (items.isEmpty()) Text("В каталоге пока нет материалов.", color = UtpMuted)
    }
}

@Composable
private fun CustomerCraftItemCard(
    item: CraftItem,
    token: String,
    runAction: RunAction,
    refresh: () -> Unit,
    onAddToShopCart: (CraftItem) -> Unit,
) {
    var quantity by remember(item.id) { mutableStateOf("1") }
    var note by remember(item.id) { mutableStateOf("") }
    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item.imageObjectId?.let { image -> RemoteProjectImage(image, token, Modifier.fillMaxWidth().height(180.dp), "Фото изделия ${item.title}") }
            Text(item.title, fontSize = 17.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(item.description.ifBlank { "Готовое изделие ручной работы." }, fontSize = 13.sp, color = UtpMuted)
            Text("${item.priceRub} ₽", fontSize = 18.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
            if (item.stockQuantity > 0) {
                Text("Готово сейчас · ${item.stockQuantity} шт.", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = UtpBlue)
                Button(onClick = { onAddToShopCart(item) }, modifier = Modifier.fillMaxWidth()) { Text("Добавить готовое в корзину") }
            }
            if (item.customOrderAvailable) {
                Text("Можно изготовить под заказ", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = UtpBlue)
                OutlinedTextField(quantity, { quantity = it.filter(Char::isDigit).take(2) }, label = { Text("Количество для изготовления") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(note, { note = it.take(2000) }, label = { Text("Пожелания, необязательно") }, modifier = Modifier.fillMaxWidth(), minLines = 2, shape = RoundedCornerShape(12.dp))
                Button(onClick = { runAction({ ApiClient.createCraftOrder(token, item.id, null, quantity.toIntOrNull()?.coerceIn(1, 99) ?: 1, note.trim()) }) { refresh() } }, modifier = Modifier.fillMaxWidth()) { Text("Обсудить изготовление") }
            }
            if (item.stockQuantity <= 0 && !item.customOrderAvailable) {
                Text("Пока нет в наличии", fontSize = 12.sp, color = UtpMuted)
            }
        }
    }
}

@Composable
private fun CraftItemManagementScreen(token: String, items: List<CraftItem>, runAction: RunAction, refresh: () -> Unit) {
    val context = LocalContext.current
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var stockQuantity by remember { mutableStateOf("0") }
    var newOrderEnabled by remember { mutableStateOf(true) }
    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("Добавить изделие", fontWeight = FontWeight.SemiBold, color = UtpInk)
            OutlinedTextField(title, { title = it.take(160) }, label = { Text("Название") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
            OutlinedTextField(description, { description = it.take(4000) }, label = { Text("Описание") }, modifier = Modifier.fillMaxWidth(), minLines = 2, shape = RoundedCornerShape(12.dp))
            OutlinedTextField(price, { price = it.filter(Char::isDigit).take(8) }, label = { Text("Цена, ₽") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
            OutlinedTextField(stockQuantity, { stockQuantity = it.filter(Char::isDigit).take(6) }, label = { Text("Готовых изделий на складе, шт.") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
            OutlinedButton(onClick = { newOrderEnabled = !newOrderEnabled }) { Text(if (newOrderEnabled) "✓ Можно изготовить под заказ" else "Заказной вариант отключён") }
            Button(
                onClick = {
                    runAction({ ApiClient.createCraftItem(token, title.trim(), description.trim(), price.toIntOrNull() ?: 0, false, newOrderEnabled, stockQuantity.toIntOrNull() ?: 0) }) { _ ->
                        title = ""; description = ""; price = ""; stockQuantity = "0"
                        refresh()
                    }
                },
                enabled = title.trim().length >= 2 && price.toIntOrNull() != null,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Сохранить изделие") }
            Text("Можно одновременно продавать готовые экземпляры и принимать заказы на изготовление. Фото добавляется после сохранения.", fontSize = 11.sp, color = UtpMuted)
        }
    }
    items.forEach { item ->
        var editedPrice by remember(item.id, item.priceRub) { mutableStateOf(item.priceRub.toString()) }
        var editedStock by remember(item.id, item.stockQuantity) { mutableStateOf(item.stockQuantity.toString()) }
        Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                Text(item.title, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Готовых на складе: ${item.stockQuantity}", fontSize = 12.sp, color = UtpMuted)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(editedPrice, { editedPrice = it.filter(Char::isDigit).take(8) }, label = { Text("Цена, ₽") }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(12.dp))
                    TextButton(onClick = { runAction({ ApiClient.updateCraftItem(token, item.id, priceRub = editedPrice.toIntOrNull()) }) { refresh() } }) { Text("Сохранить цену") }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(editedStock, { editedStock = it.filter(Char::isDigit).take(6) }, label = { Text("Остаток, шт.") }, modifier = Modifier.weight(1f), singleLine = true, shape = RoundedCornerShape(12.dp))
                    TextButton(onClick = { runAction({ ApiClient.updateCraftItem(token, item.id, stockQuantity = editedStock.toIntOrNull()) }) { refresh() } }) { Text("Сохранить остаток") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { runAction({ ApiClient.updateCraftItem(token, item.id, isPublished = !item.isPublished) }) { refresh() } }) { Text(if (item.isPublished) "Снять с публикации" else "Опубликовать") }
                    PhotoPickerButton(label = if (item.imageObjectId == null) "Добавить фото" else "Заменить фото") { uri ->
                        runAction({ ApiClient.uploadCraftImage(token, item.id, compressSelectedImage(context, uri)) }) { refresh() }
                    }
                }
            }
        }
    }
}

@Composable
private fun AdminCraftOrderCard(order: CraftOrder, token: String, staff: List<StaffMember>, runAction: RunAction, refresh: () -> Unit) {
    Card(shape = RoundedCornerShape(15.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(13.dp)) {
            Text(order.itemTitle, fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text("${order.customerName} · ${order.quantity} шт. · ${order.status}", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
            Text(order.note.ifBlank { "Без дополнительных пожеланий" }, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
            if (order.status == "COMPLETED") {
                Text("Заявка завершена", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 6.dp))
            } else {
                CraftOrderAdminControls(order, staff, token, runAction, refresh)
            }
            CraftOrderFinancePanel(order, "ADMIN", token, runAction, refresh)
            CraftOrderChatPanel(token, order.id, order.status, runAction)
        }
    }
}

@Composable
internal fun CustomerCraftOrderCard(order: CraftOrder, token: String, runAction: RunAction, refresh: () -> Unit) {
    Card(
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(order.itemTitle, fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(
                        "${order.quantity} шт. · ${order.status}",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
                Text(
                    "${order.quotedPriceRub ?: order.unitPriceRub} ₽",
                    fontWeight = FontWeight.SemiBold,
                    color = UtpBlue,
                )
            }
            CraftOrderFinancePanel(order, "CUSTOMER", token, runAction, refresh)
            CraftOrderChatPanel(token, order.id, order.status, runAction)
        }
    }
}

@Composable
private fun CraftOrderChatPanel(
    token: String,
    craftOrderId: String,
    status: String,
    runAction: RunAction,
) {
    var isOpen by remember(craftOrderId) {
        mutableStateOf(status == "IN_PROGRESS")
    }
    var chat by remember(craftOrderId) {
        mutableStateOf<CraftOrderChat?>(null)
    }
    var message by remember(craftOrderId) { mutableStateOf(TextFieldValue("")) }
    var showEmojiPicker by remember(craftOrderId) { mutableStateOf(false) }
    val context = LocalContext.current

    LaunchedEffect(status, craftOrderId) {
        if (status == "IN_PROGRESS") isOpen = true
    }
    LaunchedEffect(isOpen, craftOrderId) {
        while (isOpen) {
            runAction({ ApiClient.craftOrderChat(token, craftOrderId) }) {
                chat = it as? CraftOrderChat
            }
            delay(5_000)
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(
            onClick = { isOpen = !isOpen },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(
                if (isOpen) "Скрыть чат"
                else "Открыть чат по заявке${if (status == "IN_PROGRESS") " · В работе" else ""}",
            )
        }

        if (isOpen) {
            Column(
                Modifier.fillMaxWidth()
                    .background(UtpPale, RoundedCornerShape(12.dp))
                    .padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                val messages = chat?.messages.orEmpty()
                if (messages.isEmpty()) {
                    Text(
                        "Отправьте администратору вопрос или фото по этой заявке.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                }
                messages.forEach { entry ->
                    Card(
                        shape = RoundedCornerShape(12.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
                        ),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(10.dp),
                            verticalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Text(
                                "${entry.senderName.ifBlank { "Участник чата" }} · ${entry.senderRole}",
                                fontSize = 10.sp,
                                color = UtpMuted,
                            )
                            if (entry.content.isNotBlank()) {
                                Text(entry.content, fontSize = 13.sp, color = UtpInk)
                            }
                            entry.imageObjectId?.let { image ->
                                RemoteProjectImage(
                                    image,
                                    token,
                                    Modifier.fillMaxWidth().height(170.dp),
                                    "Фото в чате заявки",
                                )
                            }
                        }
                    }
                }
                ChatEmojiPicker(
                    visible = showEmojiPicker,
                    onEmojiSelected = { emoji ->
                        message = insertChatEmoji(message, emoji)
                        showEmojiPicker = false
                    },
                    onDismiss = { showEmojiPicker = false },
                )
                OutlinedTextField(
                    value = message,
                    onValueChange = { message = limitChatDraft(it) },
                    label = { Text("Сообщение") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 1,
                    maxLines = 4,
                    shape = RoundedCornerShape(12.dp),
                    trailingIcon = {
                        ChatEmojiToggleButton(showEmojiPicker) { showEmojiPicker = !showEmojiPicker }
                    },
                )
                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    PhotoPickerButton("Отправить фото") { uri ->
                        runAction({
                            ApiClient.uploadCraftOrderChatImage(
                                token,
                                craftOrderId,
                                compressSelectedImage(context, uri),
                            )
                            ApiClient.craftOrderChat(token, craftOrderId)
                        }) {
                            chat = it as? CraftOrderChat
                        }
                    }
                    Button(
                        onClick = {
                            val content = message.text.trim()
                            if (content.isNotEmpty()) {
                                runAction({
                                    ApiClient.sendCraftOrderChatMessage(
                                        token,
                                        craftOrderId,
                                        content,
                                    )
                                }) {
                                    chat = it as? CraftOrderChat
                                    message = TextFieldValue("")
                                }
                            }
                        },
                        enabled = message.text.isNotBlank(),
                    ) { Text("Отправить") }
                }
            }
        }
    }
}
