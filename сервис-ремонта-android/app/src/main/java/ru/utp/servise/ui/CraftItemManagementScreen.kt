package ru.utp.servise.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import ru.utp.servise.data.CraftItem

@Composable
internal fun CraftItemManagementScreen(
    token: String,
    items: List<CraftItem>,
    runAction: RunAction,
    refresh: () -> Unit,
) {
    var title by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var price by remember { mutableStateOf("") }
    var stockQuantity by remember { mutableStateOf("0") }
    var newOrderEnabled by remember { mutableStateOf(true) }

    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Добавить изделие", fontWeight = FontWeight.SemiBold, color = UtpInk)
            OutlinedTextField(
                title,
                { title = it.take(160) },
                label = { Text("Название") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
            )
            OutlinedTextField(
                description,
                { description = it.take(4000) },
                label = { Text("Описание") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                shape = RoundedCornerShape(12.dp),
            )
            OutlinedTextField(
                price,
                { price = it.filter(Char::isDigit).take(8) },
                label = { Text("Цена, ₽") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
            )
            OutlinedTextField(
                stockQuantity,
                { stockQuantity = it.filter(Char::isDigit).take(6) },
                label = { Text("Готовых изделий на складе, шт.") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
            )
            OutlinedButton(onClick = { newOrderEnabled = !newOrderEnabled }) {
                Text(if (newOrderEnabled) "✓ Можно изготовить под заказ" else "Заказной вариант отключён")
            }
            Button(
                onClick = {
                    runAction({
                        ApiClient.createCraftItem(
                            token,
                            title.trim(),
                            description.trim(),
                            price.toIntOrNull() ?: 0,
                            false,
                            newOrderEnabled,
                            stockQuantity.toIntOrNull() ?: 0,
                        )
                    }) {
                        title = ""
                        description = ""
                        price = ""
                        stockQuantity = "0"
                        refresh()
                    }
                },
                enabled = title.trim().length >= 2 && price.toIntOrNull() != null,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Сохранить изделие")
            }
            Text(
                "Фото можно добавить после сохранения. Для карточки доступно не более трёх фотографий.",
                fontSize = 11.sp,
                color = UtpMuted,
            )
        }
    }

    items.forEach { item ->
        CraftItemEditorCard(item, token, runAction, refresh)
    }
}

@Composable
private fun CraftItemEditorCard(
    item: CraftItem,
    token: String,
    runAction: RunAction,
    refresh: () -> Unit,
) {
    val context = LocalContext.current
    var title by remember(item.id, item.title) { mutableStateOf(item.title) }
    var description by remember(item.id, item.description) { mutableStateOf(item.description) }
    var price by remember(item.id, item.priceRub) { mutableStateOf(item.priceRub.toString()) }
    var stock by remember(item.id, item.stockQuantity) { mutableStateOf(item.stockQuantity.toString()) }
    var isPublished by remember(item.id, item.isPublished) { mutableStateOf(item.isPublished) }
    var customOrderAvailable by remember(item.id, item.customOrderAvailable) {
        mutableStateOf(item.customOrderAvailable)
    }
    var confirmingDelete by remember(item.id) { mutableStateOf(false) }
    val imageIds = (item.imageObjectIds.ifEmpty { listOfNotNull(item.imageObjectId) }).distinct()

    Card(
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(item.title, fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                if (item.isPublished) "Опубликовано" else "Черновик",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            OutlinedTextField(
                title,
                { title = it.take(160) },
                label = { Text("Название") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                shape = RoundedCornerShape(12.dp),
            )
            OutlinedTextField(
                description,
                { description = it.take(4000) },
                label = { Text("Описание") },
                modifier = Modifier.fillMaxWidth(),
                minLines = 2,
                shape = RoundedCornerShape(12.dp),
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    price,
                    { price = it.filter(Char::isDigit).take(8) },
                    label = { Text("Цена, ₽") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    stock,
                    { stock = it.filter(Char::isDigit).take(6) },
                    label = { Text("Остаток, шт.") },
                    modifier = Modifier.weight(1f),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                )
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { isPublished = !isPublished }) {
                    Text(if (isPublished) "Снять с публикации" else "Опубликовать")
                }
                OutlinedButton(onClick = { customOrderAvailable = !customOrderAvailable }) {
                    Text(if (customOrderAvailable) "Заказ доступен" else "Заказ выключен")
                }
            }
            Button(
                onClick = {
                    runAction({
                        ApiClient.updateCraftItem(
                            token = token,
                            itemId = item.id,
                            title = title.trim(),
                            description = description.trim(),
                            priceRub = price.toIntOrNull(),
                            isPublished = isPublished,
                            stockQuantity = stock.toIntOrNull(),
                            customOrderAvailable = customOrderAvailable,
                        )
                    }) { refresh() }
                },
                enabled = title.trim().length >= 2 && price.toIntOrNull() != null && stock.toIntOrNull() != null,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Сохранить изменения")
            }

            if (imageIds.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    imageIds.forEachIndexed { index, objectId ->
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            RemoteProjectImage(
                                objectId = objectId,
                                token = token,
                                modifier = Modifier.size(76.dp),
                                contentDescription = "Фото ${index + 1}: ${item.title}",
                            )
                            TextButton(
                                onClick = {
                                    runAction({ ApiClient.deleteCraftItemImage(token, item.id, objectId) }) {
                                        refresh()
                                    }
                                },
                            ) {
                                Text("Удалить фото", fontSize = 11.sp)
                            }
                        }
                    }
                }
            }
            if (imageIds.size < 3) {
                PhotoPickerButton(label = "Добавить фото · ${imageIds.size}/3") { uri ->
                    runAction({
                        ApiClient.uploadCraftItemImage(
                            token,
                            item.id,
                            compressSelectedImage(context, uri),
                        )
                    }) { refresh() }
                }
            }

            TextButton(
                onClick = { confirmingDelete = true },
                modifier = Modifier.align(Alignment.End),
            ) {
                Text("Удалить карточку полностью", color = androidx.compose.material3.MaterialTheme.colorScheme.error)
            }
        }
    }

    if (confirmingDelete) {
        AlertDialog(
            onDismissRequest = { confirmingDelete = false },
            title = { Text("Удалить карточку изделия?") },
            text = {
                Text(
                    "Карточка и её фотографии будут удалены. История завершённых заказов сохранится; если по изделию есть незавершённый заказ, сервер не разрешит удаление.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        runAction({ ApiClient.deleteCraftItem(token, item.id) }) {
                            confirmingDelete = false
                            refresh()
                        }
                    },
                ) {
                    Text("Удалить", color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmingDelete = false }) { Text("Отмена") }
            },
        )
    }
}
