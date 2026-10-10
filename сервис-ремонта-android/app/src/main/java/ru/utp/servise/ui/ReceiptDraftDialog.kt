package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.FreeSaleReceiptDraftItem
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.ReceiptDraftItemQuantity

@Composable
internal fun ReceiptDraftDialog(
    order: RepairOrder,
    saving: Boolean,
    onDismiss: () -> Unit,
    onSave: (List<ReceiptDraftItemQuantity>, FreeSaleReceiptDraftItem?) -> Unit,
) {
    var quantities by remember(order.id) {
        mutableStateOf(order.items.associate { it.id to it.quantity.toString() })
    }
    var freeSaleType by remember(order.id) { mutableStateOf("SPARE_PART") }
    var freeSaleName by remember(order.id) { mutableStateOf("") }
    var freeSaleQuantity by remember(order.id) { mutableStateOf("1") }
    var freeSalePrice by remember(order.id) { mutableStateOf("") }
    val quantityNumbers = quantities.mapValues { it.value.toIntOrNull() }
    val newQuantity = freeSaleQuantity.toIntOrNull()
    val newPrice = freeSalePrice.toIntOrNull()
    val hasFreeSale = freeSaleName.trim().isNotEmpty()
    val freeSaleValid = !hasFreeSale ||
        (freeSaleName.trim().length <= 160 && newQuantity != null && newQuantity in 1..99 &&
            newPrice != null && newPrice in 1..Int.MAX_VALUE)
    val quantitiesValid = order.items.all { quantityNumbers[it.id]?.let { value -> value in 0..99 } == true }
    val canSave = quantitiesValid && freeSaleValid && !saving
    val total = order.items.sumOf { item ->
        (quantityNumbers[item.id] ?: 0) * item.unitPriceRub
    } + if (hasFreeSale && freeSaleValid) (newQuantity ?: 0) * (newPrice ?: 0) else 0

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (order.receipt == null) "Состав чека" else "Изменить чек") },
        text = {
            Column(
                Modifier.fillMaxWidth().heightIn(max = 480.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(9.dp),
            ) {
                Text(
                    "Укажите 0, чтобы удалить услугу, запчасть или товар. Склад, скидка и расчёт мастера пересчитаются. Оплаченный чек изменить нельзя.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
                order.items.forEach { item ->
                    OutlinedTextField(
                        value = quantities[item.id].orEmpty(),
                        onValueChange = { value ->
                            quantities = quantities + (item.id to value.filter(Char::isDigit).take(2))
                        },
                        label = { Text("${item.name} · ${item.unitPriceRub} ₽ · 0 — удалить") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    )
                }
                Text("Свободная продажа", fontWeight = FontWeight.SemiBold)
                OutlinedTextField(
                    value = freeSaleName,
                    onValueChange = { freeSaleName = it.take(160) },
                    label = { Text("Название новой позиции") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
                    if (freeSaleType == "SPARE_PART") Button(onClick = { freeSaleType = "SPARE_PART" }) { Text("Запчасть") }
                    else OutlinedButton(onClick = { freeSaleType = "SPARE_PART" }) { Text("Запчасть") }
                    if (freeSaleType == "PRODUCT") Button(onClick = { freeSaleType = "PRODUCT" }) { Text("Товар") }
                    else OutlinedButton(onClick = { freeSaleType = "PRODUCT" }) { Text("Товар") }
                    if (freeSaleType == "SERVICE") Button(onClick = { freeSaleType = "SERVICE" }) { Text("Услуга") }
                    else OutlinedButton(onClick = { freeSaleType = "SERVICE" }) { Text("Услуга") }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(
                        value = freeSaleQuantity,
                        onValueChange = { freeSaleQuantity = it.filter(Char::isDigit).take(2) },
                        label = { Text("Количество") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = freeSalePrice,
                        onValueChange = { freeSalePrice = it.filter(Char::isDigit).take(10) },
                        label = { Text("Цена, ₽") },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    )
                }
                Text("Предварительный итог: $total ₽", fontWeight = FontWeight.SemiBold)
            }
        },
        confirmButton = {
            TextButton(
                enabled = canSave,
                onClick = {
                    onSave(
                        order.items.map { item ->
                            ReceiptDraftItemQuantity(item.id, quantityNumbers[item.id]!!)
                        },
                        if (hasFreeSale) {
                            FreeSaleReceiptDraftItem(
                                type = freeSaleType,
                                name = freeSaleName.trim(),
                                quantity = newQuantity!!,
                                unitPriceRub = newPrice!!,
                            )
                        } else null,
                    )
                },
            ) { Text(if (saving) "Сохраняем…" else "Сохранить чек") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
