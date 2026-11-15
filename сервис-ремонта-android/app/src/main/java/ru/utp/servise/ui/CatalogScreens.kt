package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.orderItemTypeLabel

internal const val DEFAULT_MINIMUM_STOCK_QUANTITY = 3

private fun isRestockNeeded(stockQuantity: Int?, minimumStockQuantity: Int?): Boolean =
    stockQuantity != null &&
        (stockQuantity == 0 ||
            stockQuantity <= (minimumStockQuantity ?: DEFAULT_MINIMUM_STOCK_QUANTITY))

private fun isBelowRestockThreshold(stockQuantity: Int?, minimumStockQuantity: Int?): Boolean =
    stockQuantity != null &&
        stockQuantity > 0 &&
        stockQuantity <= (minimumStockQuantity ?: DEFAULT_MINIMUM_STOCK_QUANTITY)

@Composable
fun OrderItemPickerDialog(
    catalogItems: List<CatalogItem>,
    onDismiss: () -> Unit,
    onAdd: (catalogItemId: String, quantity: Int) -> Unit,
) {
    val availableItems = catalogItems.filterNot {
        it.type != "SERVICE" && it.stockQuantity == 0
    }
    var selectedId by remember(availableItems) {
        mutableStateOf(availableItems.firstOrNull()?.id.orEmpty())
    }
    var quantityText by remember { mutableStateOf("1") }
    val selectedItem = availableItems.firstOrNull { it.id == selectedId }
    val quantity = quantityText.toIntOrNull()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Добавить из каталога") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(9.dp)) {
                if (availableItems.isEmpty()) {
                    Text("Активных позиций пока нет. Попросите администратора добавить их в каталог.", color = UtpMuted)
                } else {
                    Text("Выберите услугу, запчасть или товар:", fontSize = 12.sp, color = UtpMuted)
                    Column(
                        Modifier.fillMaxWidth().heightIn(max = 330.dp).verticalScroll(rememberScrollState()),
                        verticalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        availableItems.forEach { item ->
                            val onSelected = selectedId == item.id
                            if (onSelected) {
                                Button(onClick = { selectedId = item.id }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.Start) {
                                        Text("${item.type.orderItemTypeLabel()} · ${item.name}")
                                        Text(itemStockLabel(item), fontSize = 11.sp)
                                    }
                                }
                            } else {
                                OutlinedButton(onClick = { selectedId = item.id }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                                    Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.Start) {
                                        Text("${item.type.orderItemTypeLabel()} · ${item.name}", color = UtpInk)
                                        Text(itemStockLabel(item), fontSize = 11.sp, color = UtpMuted)
                                    }
                                }
                            }
                        }
                    }
                    OutlinedTextField(
                        value = quantityText,
                        onValueChange = { quantityText = it.filter(Char::isDigit).take(2) },
                        label = { Text("Количество (1–99)") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                    if (selectedItem != null && quantity != null && quantity in 1..99) {
                        Text("Итого: ${selectedItem.unitPriceRub.toLong() * quantity} ₽", fontWeight = FontWeight.SemiBold, color = UtpBlue)
                    }
                }
            }
        },
        confirmButton = {
            TextButton(
                onClick = { selectedItem?.let { onAdd(it.id, quantity!!) } },
                enabled = selectedItem != null && quantity != null && quantity in 1..99,
            ) { Text("Добавить в заказ") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@Composable
fun CatalogManagementScreen(
    token: String,
    catalogItems: List<CatalogItem>,
    runAction: RunAction,
    refresh: () -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    var showRestockOnly by remember { mutableStateOf(false) }
    var type by remember { mutableStateOf("SERVICE") }
    var name by remember { mutableStateOf("") }
    var description by remember { mutableStateOf("") }
    var priceText by remember { mutableStateOf("") }
    var stockText by remember { mutableStateOf("0") }
    var minimumStockText by remember {
        mutableStateOf(DEFAULT_MINIMUM_STOCK_QUANTITY.toString())
    }
    var selectedDeviceTypes by remember { mutableStateOf(repairDeviceTypes.toSet()) }
    var deviceTypeFilter by remember { mutableStateOf(ALL_REPAIR_DEVICE_TYPES) }
    var editedItem by remember { mutableStateOf<CatalogItem?>(null) }
    var pendingDeleteItem by remember { mutableStateOf<CatalogItem?>(null) }
    val price = priceText.toIntOrNull()
    val stockTrackedItems = catalogItems.filter {
        it.active && it.type != "SERVICE" && it.stockQuantity != null
    }
    val outOfStockItems = stockTrackedItems.filter { (it.stockQuantity ?: 0) <= 0 }
    val lowStockItems = stockTrackedItems.filter {
        isBelowRestockThreshold(it.stockQuantity, it.minimumStockQuantity)
    }
    val restockItems = stockTrackedItems.filter {
        isRestockNeeded(it.stockQuantity, it.minimumStockQuantity)
    }
    val restockItemIds = restockItems.mapTo(mutableSetOf()) { it.id }
    val visibleCatalogItems = (if (showRestockOnly) {
        catalogItems.filter { it.id in restockItemIds }
    } else {
        catalogItems
    }).filter { item ->
        item.type == "PRODUCT" || deviceTypeFilter == ALL_REPAIR_DEVICE_TYPES || deviceTypeFilter in item.deviceTypes
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Управление") }
        Text("Каталог сервиса", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Услуги, запчасти и товары. Мастерам доступны только активные позиции.", fontSize = 12.sp, color = UtpMuted)
        Card(
            shape = RoundedCornerShape(18.dp),
            colors = CardDefaults.cardColors(
                containerColor = androidx.compose.material3.MaterialTheme.colorScheme.tertiaryContainer,
            ),
        ) {
            Column(Modifier.fillMaxWidth().padding(15.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                Text(
                    "Контроль остатков",
                    fontWeight = FontWeight.SemiBold,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.onTertiaryContainer,
                )
                Text(
                    when {
                        stockTrackedItems.isEmpty() -> "У активных запчастей и товаров пока не указан остаток. Добавьте его в карточке позиции."
                        restockItems.isEmpty() -> "На складе ${stockTrackedItems.size} активных позиций — запас в норме."
                        else -> "Нужно пополнить: ${restockItems.size} · закончилось: ${outOfStockItems.size} · на пороге или ниже: ${lowStockItems.size}"
                    },
                    fontSize = 12.sp,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.onTertiaryContainer,
                )
                Text(
                    "Для каждой позиции задаётся свой порог. Нулевой остаток отмечается всегда; услуги и скрытые позиции не учитываются.",
                    fontSize = 11.sp,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.onTertiaryContainer,
                )
                if (restockItems.isNotEmpty() || showRestockOnly) {
                    if (showRestockOnly) {
                        OutlinedButton(onClick = { showRestockOnly = false }) { Text("Показать весь каталог") }
                    } else {
                        Button(onClick = { showRestockOnly = true }) {
                            Text("К пополнению (${restockItems.size})")
                        }
                    }
                }
            }
        }
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Новая позиция", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    if (type == "SERVICE") Button(onClick = { type = "SERVICE" }) { Text("Услуга") }
                    else OutlinedButton(onClick = { type = "SERVICE" }) { Text("Услуга") }
                    if (type == "SPARE_PART") Button(onClick = { type = "SPARE_PART" }) { Text("Запчасть") }
                    else OutlinedButton(onClick = { type = "SPARE_PART" }) { Text("Запчасть") }
                    if (type == "PRODUCT") Button(onClick = { type = "PRODUCT" }) { Text("Товар") }
                    else OutlinedButton(onClick = { type = "PRODUCT" }) { Text("Товар") }
                }
                if (type != "PRODUCT") {
                    Text("Подходит для устройств", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = UtpInk)
                    RepairDeviceTypePicker(selectedDeviceTypes) { deviceType ->
                        selectedDeviceTypes = if (deviceType in selectedDeviceTypes) {
                            selectedDeviceTypes - deviceType
                        } else {
                            selectedDeviceTypes + deviceType
                        }
                    }
                }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Название") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = priceText,
                    onValueChange = { priceText = it.filter(Char::isDigit).take(8) },
                    label = { Text("Цена, ₽") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                if (type == "PRODUCT") {
                    OutlinedTextField(
                        value = description,
                        onValueChange = { description = it.take(2000) },
                        label = { Text("Описание товара") },
                        supportingText = { Text("До 2 000 символов") },
                        minLines = 2,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                }
                if (type != "SERVICE") {
                    OutlinedTextField(
                        value = stockText,
                        onValueChange = { stockText = it.filter(Char::isDigit).take(10) },
                        label = { Text("Начальный остаток, шт.") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = minimumStockText,
                        onValueChange = { minimumStockText = it.filter(Char::isDigit).take(10) },
                        label = { Text("Минимальный остаток для сигнала, шт.") },
                        supportingText = { Text("0 — сигнал только при нулевом остатке.") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                }
                val minimumStock = minimumStockText.toIntOrNull()
                Button(
                    onClick = {
                        runAction({
                            ApiClient.createCatalogItem(
                                token,
                                type,
                                name.trim(),
                                price!!,
                                if (type != "SERVICE") stockText.toIntOrNull() ?: 0 else null,
                                if (type != "SERVICE") minimumStock else null,
                                if (type == "PRODUCT") description.trim().takeIf { it.isNotEmpty() } else null,
                                if (type == "PRODUCT") repairDeviceTypes else selectedDeviceTypes.toList(),
                            )
                        }) {
                            name = ""
                            description = ""
                            priceText = ""
                            stockText = "0"
                            minimumStockText = DEFAULT_MINIMUM_STOCK_QUANTITY.toString()
                            selectedDeviceTypes = repairDeviceTypes.toSet()
                        }
                    },
                    enabled = name.trim().length >= 2 && price != null && price in 0..10_000_000 &&
                        (type == "SERVICE" ||
                            (stockText.toIntOrNull() != null && minimumStock != null)) &&
                        (type == "PRODUCT" || selectedDeviceTypes.isNotEmpty()),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Добавить в каталог") }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text(
                if (showRestockOnly) "Требуют пополнения (${visibleCatalogItems.size})" else "Позиции прайса (${visibleCatalogItems.size})",
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
                modifier = Modifier.weight(1f),
            )
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        Text("Показывать услуги и запчасти для устройства", fontSize = 12.sp, color = UtpMuted)
        RepairDeviceTypeFilter(deviceTypeFilter) { deviceTypeFilter = it }
        if (catalogItems.isEmpty()) Text("Каталог пока пуст. Добавьте первую позицию.", color = UtpMuted)
        else if (visibleCatalogItems.isEmpty()) {
            Text(
                "Активных запчастей и товаров ниже заданного порога нет.",
                color = UtpMuted,
            )
        }
        visibleCatalogItems.forEach { item ->
            val stockQuantity = item.stockQuantity
            val isTrackedActiveItem = item.active && item.type != "SERVICE" && stockQuantity != null
            val minimumStockQuantity = item.minimumStockQuantity
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text("${item.type.orderItemTypeLabel()} · ${item.name}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    if (item.type == "SERVICE" || item.type == "SPARE_PART") {
                        Text(
                            "Подходит для: ${item.deviceTypes.filter { it in repairDeviceTypes }.joinToString { it.deviceLabel() }}",
                            fontSize = 11.sp,
                            color = UtpMuted,
                        )
                    }
                    Text(
                        "${item.unitPriceRub} ₽ · ${if (item.active) "Активна" else "Скрыта из выбора"}" +
                            if (item.type != "SERVICE") {
                                " · ${item.stockQuantity?.let { "$it шт. в наличии" } ?: "остаток не задан"}" +
                                    if (item.stockQuantity != null) {
                                        " · порог ${minimumStockQuantity ?: DEFAULT_MINIMUM_STOCK_QUANTITY} шт."
                                    } else ""
                            } else "",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                    if (isTrackedActiveItem && isRestockNeeded(stockQuantity, minimumStockQuantity)) {
                        Text(
                            if (stockQuantity == 0) "Закончилась — пополните запас"
                            else "Мало на складе — осталось $stockQuantity шт.",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (stockQuantity == 0) androidx.compose.material3.MaterialTheme.colorScheme.error else UtpAmber,
                            modifier = Modifier.padding(top = 5.dp),
                        )
                    }
                    if (item.type == "PRODUCT") {
                        item.description?.takeIf { it.isNotBlank() }?.let {
                            Text(it, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 6.dp))
                        }
                        if (item.imageObjectIds.isNotEmpty()) {
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.padding(top = 8.dp),
                            ) {
                                item.imageObjectIds.take(4).forEachIndexed { index, objectId ->
                                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                        RemoteProjectImage(
                                            objectId = objectId,
                                            token = token,
                                            modifier = Modifier.size(72.dp),
                                            contentDescription = "Фото ${index + 1}: ${item.name}",
                                        )
                                        TextButton(
                                            onClick = {
                                                runAction({
                                                    ApiClient.deleteCatalogProductImage(token, item.id, objectId)
                                                }) { refresh() }
                                            },
                                        ) { Text("Удалить", fontSize = 10.sp) }
                                    }
                                }
                            }
                        }
                        if (item.imageObjectIds.size < 3) {
                            PhotoPickerButton(
                                label = "Добавить фото · ${item.imageObjectIds.size}/3",
                            ) { uri ->
                                runAction({
                                    ApiClient.uploadCatalogProductImage(
                                        token,
                                        item.id,
                                        compressSelectedImage(context, uri),
                                    )
                                }) { refresh() }
                            }
                        }
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { editedItem = item }) { Text("Изменить") }
                        TextButton(
                            onClick = {
                                runAction({ ApiClient.updateCatalogItem(token, item.copy(active = !item.active)) }) {}
                            },
                        ) { Text(if (item.active) "Отключить" else "Включить") }
                        TextButton(onClick = { pendingDeleteItem = item }) {
                            Text("Удалить навсегда", color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(4.dp))
    }

    editedItem?.let { item ->
        CatalogItemEditDialog(
            item = item,
            onDismiss = { editedItem = null },
            onSave = { updated ->
                runAction({ ApiClient.updateCatalogItem(token, updated) }) { editedItem = null }
            },
        )
    }

    pendingDeleteItem?.let { item ->
        CatalogItemDeleteDialog(
            itemName = item.name,
            requiresZeroStock = item.type != "SERVICE",
            onDismiss = { pendingDeleteItem = null },
            onDelete = {
                pendingDeleteItem = null
                runAction({ ApiClient.deleteCatalogItem(token, item.id) }) { refresh() }
            },
        )
    }
}

private fun itemStockLabel(item: CatalogItem): String =
    "${item.unitPriceRub} ₽ за единицу" +
        if (item.type != "SERVICE") {
            " · ${item.stockQuantity?.let { "$it шт. в наличии" } ?: "остаток не задан"}"
        } else ""
