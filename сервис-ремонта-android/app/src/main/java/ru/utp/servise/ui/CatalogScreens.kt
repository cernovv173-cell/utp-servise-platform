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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.orderItemTypeLabel

private const val LOW_STOCK_THRESHOLD = 3

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
    var showRestockOnly by remember { mutableStateOf(false) }
    var type by remember { mutableStateOf("SERVICE") }
    var name by remember { mutableStateOf("") }
    var priceText by remember { mutableStateOf("") }
    var stockText by remember { mutableStateOf("0") }
    var editedItem by remember { mutableStateOf<CatalogItem?>(null) }
    val price = priceText.toIntOrNull()
    val stockTrackedItems = catalogItems.filter {
        it.active && it.type != "SERVICE" && it.stockQuantity != null
    }
    val outOfStockItems = stockTrackedItems.filter { (it.stockQuantity ?: 0) <= 0 }
    val lowStockItems = stockTrackedItems.filter {
        (it.stockQuantity ?: 0) in 1..LOW_STOCK_THRESHOLD
    }
    val restockItems = stockTrackedItems.filter {
        (it.stockQuantity ?: 0) <= LOW_STOCK_THRESHOLD
    }
    val restockItemIds = restockItems.mapTo(mutableSetOf()) { it.id }
    val visibleCatalogItems = if (showRestockOnly) {
        catalogItems.filter { it.id in restockItemIds }
    } else {
        catalogItems
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
                        else -> "Нужно пополнить: ${restockItems.size} · закончилось: ${outOfStockItems.size} · осталось 1–3: ${lowStockItems.size}"
                    },
                    fontSize = 12.sp,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.onTertiaryContainer,
                )
                Text(
                    "Сигнал появляется при остатке $LOW_STOCK_THRESHOLD шт. или меньше. Услуги и скрытые позиции не учитываются.",
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
                }
                Button(
                    onClick = {
                        runAction({
                            ApiClient.createCatalogItem(
                                token,
                                type,
                                name.trim(),
                                price!!,
                                if (type != "SERVICE") stockText.toIntOrNull() ?: 0 else null,
                            )
                        }) {
                            name = ""
                            priceText = ""
                            stockText = "0"
                        }
                    },
                    enabled = name.trim().length >= 2 && price != null && price in 0..10_000_000 &&
                        (type == "SERVICE" || stockText.toIntOrNull() != null),
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
        if (catalogItems.isEmpty()) Text("Каталог пока пуст. Добавьте первую позицию.", color = UtpMuted)
        else if (visibleCatalogItems.isEmpty()) {
            Text(
                "Активных запчастей и товаров с остатком $LOW_STOCK_THRESHOLD шт. или меньше нет.",
                color = UtpMuted,
            )
        }
        visibleCatalogItems.forEach { item ->
            val stockQuantity = item.stockQuantity
            val isTrackedActiveItem = item.active && item.type != "SERVICE" && stockQuantity != null
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(14.dp)) {
                    Text("${item.type.orderItemTypeLabel()} · ${item.name}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text(
                        "${item.unitPriceRub} ₽ · ${if (item.active) "Активна" else "Скрыта из выбора"}" +
                            if (item.type != "SERVICE") " · ${item.stockQuantity?.let { "$it шт. в наличии" } ?: "остаток не задан"}" else "",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                    if (isTrackedActiveItem && stockQuantity!! <= LOW_STOCK_THRESHOLD) {
                        Text(
                            if (stockQuantity <= 0) "Закончилась — пополните запас" else "Мало на складе — осталось $stockQuantity шт.",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = if (stockQuantity <= 0) androidx.compose.material3.MaterialTheme.colorScheme.error else UtpAmber,
                            modifier = Modifier.padding(top = 5.dp),
                        )
                    }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                        TextButton(onClick = { editedItem = item }) { Text("Изменить") }
                        TextButton(
                            onClick = {
                                runAction({ ApiClient.updateCatalogItem(token, item.copy(active = !item.active)) }) {}
                            },
                        ) { Text(if (item.active) "Отключить" else "Включить") }
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
}

@Composable
private fun CatalogItemEditDialog(
    item: CatalogItem,
    onDismiss: () -> Unit,
    onSave: (CatalogItem) -> Unit,
) {
    var type by remember(item.id) { mutableStateOf(item.type) }
    var name by remember(item.id) { mutableStateOf(item.name) }
    var priceText by remember(item.id) { mutableStateOf(item.unitPriceRub.toString()) }
    var stockText by remember(item.id) { mutableStateOf((item.stockQuantity ?: 0).toString()) }
    val price = priceText.toIntOrNull()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Изменить позицию") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    if (type == "SERVICE") Button(onClick = { type = "SERVICE" }) { Text("Услуга") }
                    else OutlinedButton(onClick = { type = "SERVICE" }) { Text("Услуга") }
                    if (type == "SPARE_PART") Button(onClick = { type = "SPARE_PART" }) { Text("Запчасть") }
                    else OutlinedButton(onClick = { type = "SPARE_PART" }) { Text("Запчасть") }
                    if (type == "PRODUCT") Button(onClick = { type = "PRODUCT" }) { Text("Товар") }
                    else OutlinedButton(onClick = { type = "PRODUCT" }) { Text("Товар") }
                }
                OutlinedTextField(name, { name = it }, label = { Text("Название") }, singleLine = true, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp))
                OutlinedTextField(
                    priceText,
                    { priceText = it.filter(Char::isDigit).take(8) },
                    label = { Text("Цена, ₽") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                if (type != "SERVICE") {
                    OutlinedTextField(
                        value = stockText,
                        onValueChange = { stockText = it.filter(Char::isDigit).take(10) },
                        label = { Text("Остаток, шт.") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                }
                Text("Изменение каталога не меняет цены уже добавленных в заказы позиций.", fontSize = 11.sp, color = UtpMuted)
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        item.copy(
                            type = type,
                            name = name.trim(),
                            unitPriceRub = price!!,
                            stockQuantity = if (type != "SERVICE") stockText.toIntOrNull() else null,
                        ),
                    )
                },
                enabled = name.trim().length >= 2 && price != null && price in 0..10_000_000 &&
                    (type == "SERVICE" || stockText.toIntOrNull() != null),
            ) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

private fun itemStockLabel(item: CatalogItem): String =
    "${item.unitPriceRub} ₽ за единицу" +
        if (item.type != "SERVICE") {
            " · ${item.stockQuantity?.let { "$it шт. в наличии" } ?: "остаток не задан"}"
        } else ""
