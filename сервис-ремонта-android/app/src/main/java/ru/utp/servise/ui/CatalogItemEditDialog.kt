package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CatalogItem

@Composable
internal fun CatalogItemEditDialog(
    item: CatalogItem,
    onDismiss: () -> Unit,
    onSave: (CatalogItem) -> Unit,
) {
    var type by remember(item.id) { mutableStateOf(item.type) }
    var name by remember(item.id) { mutableStateOf(item.name) }
    var description by remember(item.id) { mutableStateOf(item.description.orEmpty()) }
    var priceText by remember(item.id) { mutableStateOf(item.unitPriceRub.toString()) }
    var stockText by remember(item.id) { mutableStateOf(item.stockQuantity?.toString().orEmpty()) }
    var minimumStockText by remember(item.id) {
        mutableStateOf((item.minimumStockQuantity ?: DEFAULT_MINIMUM_STOCK_QUANTITY).toString())
    }
    val price = priceText.toIntOrNull()
    val minimumStock = minimumStockText.toIntOrNull()

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
                        label = { Text("Остаток, шт.") },
                        supportingText = {
                            if (item.stockQuantity == null && item.type != "SERVICE") {
                                Text("Учёт остатка ещё не настроен — укажите фактическое количество.")
                            }
                        },
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
                Text(
                    "Изменение каталога не меняет цены уже добавленных в заказы позиций.",
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        item.copy(
                            type = type,
                            name = name.trim(),
                            description = if (type == "PRODUCT") description.trim().takeIf { it.isNotEmpty() } else null,
                            unitPriceRub = price!!,
                            stockQuantity = if (type != "SERVICE") stockText.toIntOrNull() else null,
                            minimumStockQuantity = if (type != "SERVICE") minimumStock else null,
                        ),
                    )
                },
                enabled = name.trim().length >= 2 && price != null && price in 0..10_000_000 &&
                    (type == "SERVICE" || (stockText.toIntOrNull() != null && minimumStock != null)),
            ) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
