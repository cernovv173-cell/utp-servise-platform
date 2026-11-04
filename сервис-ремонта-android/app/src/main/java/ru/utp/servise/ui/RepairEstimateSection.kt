package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.RepairEstimate
import ru.utp.servise.data.RepairEstimateDraftItem
import ru.utp.servise.data.RepairOrder

private data class DraftLine(val catalogItem: CatalogItem, var quantity: String = "1")

private fun estimateStatusLabel(status: String): String = when (status) {
    "PENDING" -> "Ждёт ответа"
    "APPROVED" -> "Согласована"
    "DECLINED" -> "Отклонена"
    else -> "Заменена новой версией"
}

private fun estimateKindLabel(kind: String): String =
    if (kind == "ADDITIONAL") "Дополнительные работы" else "Первоначальная смета"

private fun itemTypeLabel(type: String): String = when (type) {
    "SERVICE" -> "Работа"
    "SPARE_PART" -> "Запчасть"
    else -> "Товар"
}

@Composable
internal fun RepairEstimateSection(
    order: RepairOrder,
    role: String,
    token: String,
    catalogItems: List<CatalogItem>,
    runAction: RunAction,
) {
    val latest = order.estimates.lastOrNull()
    val canManage = role == "ADMIN" || role == "TECHNICIAN"
    val canCompose = canManage &&
        order.status in listOf("ASSIGNED", "IN_PROGRESS") &&
        !(order.status == "ASSIGNED" && latest?.status == "APPROVED") &&
        (role != "ADMIN" || order.technicianName.isNotBlank())
    val isVisible = canCompose || role == "CUSTOMER" || order.estimates.isNotEmpty()
    var showComposer by remember(order.id) { mutableStateOf(false) }
    var responseNote by remember(order.id) { mutableStateOf("") }

    if (!isVisible) return

    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.48f)),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("СМЕТА И СОГЛАСИЕ", fontSize = 10.sp, color = UtpBlue, fontWeight = FontWeight.Bold, letterSpacing = 1.3.sp)
            Text("Стоимость ремонта", fontSize = 15.sp, color = UtpInk, fontWeight = FontWeight.SemiBold)
            Text(
                "Запчасти не списываются до согласия. Дополнительные работы потребуют отдельного подтверждения.",
                fontSize = 11.sp,
                color = UtpMuted,
                lineHeight = 16.sp,
            )

            if (order.estimates.isEmpty()) {
                Text("Смета пока не отправлена.", fontSize = 12.sp, color = UtpMuted)
            } else {
                order.estimates.asReversed().forEach { estimate ->
                    EstimateHistoryCard(estimate)
                }
            }

            if (role == "CUSTOMER" && latest?.status == "PENDING") {
                OutlinedTextField(
                    value = responseNote,
                    onValueChange = { responseNote = it.take(500) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Вопрос или комментарий (необязательно)") },
                    minLines = 2,
                    maxLines = 4,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        onClick = {
                            runAction(
                                {
                                    ApiClient.respondToRepairEstimate(
                                        token, order.id, latest.id, "APPROVED", responseNote.ifBlank { null },
                                    )
                                },
                            ) { responseNote = "" }
                        },
                        modifier = Modifier.weight(1f),
                    ) { Text("Согласовать") }
                    OutlinedButton(
                        onClick = {
                            runAction(
                                {
                                    ApiClient.respondToRepairEstimate(
                                        token, order.id, latest.id, "DECLINED", responseNote.ifBlank { null },
                                    )
                                },
                            ) { responseNote = "" }
                        },
                        modifier = Modifier.weight(1f),
                    ) { Text("Отказать / уточнить") }
                }
            }

            if (canCompose) {
                Button(
                    onClick = { showComposer = true },
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(if (order.status == "IN_PROGRESS") "Предложить дополнительные работы" else "Подготовить смету")
                }
            }
        }
    }

    if (showComposer) {
        RepairEstimateComposerDialog(
            catalogItems = catalogItems.filter { item ->
                item.active && (item.type == "PRODUCT" || order.deviceType in item.deviceTypes)
            },
            onDismiss = { showComposer = false },
            onSubmit = { diagnosis, lines ->
                runAction(
                    { ApiClient.submitRepairEstimate(token, order.id, diagnosis, lines) },
                ) { showComposer = false }
            },
        )
    }
}

@Composable
private fun EstimateHistoryCard(estimate: RepairEstimate) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(androidx.compose.material3.MaterialTheme.colorScheme.surface, RoundedCornerShape(12.dp))
            .padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${estimateKindLabel(estimate.kind)} · №${estimate.version}",
                modifier = Modifier.weight(1f),
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
            )
            Text(estimateStatusLabel(estimate.status), fontSize = 10.sp, color = UtpBlue)
        }
        Text(estimate.diagnosis, fontSize = 11.sp, lineHeight = 16.sp, color = UtpMuted)
        estimate.itemsSnapshot.forEach { item ->
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(item.name, fontSize = 11.sp, color = UtpInk)
                    Text(
                        "${itemTypeLabel(item.type)} · ${item.quantity} × ${item.unitPriceRub} ₽",
                        fontSize = 10.sp,
                        color = UtpMuted,
                    )
                }
                Text("${item.quantity.toLong() * item.unitPriceRub} ₽", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
            }
        }
        Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(estimate.createdByName.orEmpty(), modifier = Modifier.weight(1f), fontSize = 10.sp, color = UtpMuted)
            Text("Итого: ${estimate.totalRub} ₽", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
        }
        estimate.customerResponseNote?.let {
            Text("Ответ клиента: $it", fontSize = 10.sp, color = UtpMuted)
        }
    }
}

@Composable
private fun RepairEstimateComposerDialog(
    catalogItems: List<CatalogItem>,
    onDismiss: () -> Unit,
    onSubmit: (String, List<RepairEstimateDraftItem>) -> Unit,
) {
    var diagnosis by remember { mutableStateOf("") }
    val lines = remember { mutableStateListOf<DraftLine>() }
    var showCatalog by remember { mutableStateOf(false) }
    var validation by remember { mutableStateOf<String?>(null) }
    val selectableItems = catalogItems.filter { item ->
        item.type == "SERVICE" || item.stockQuantity == null || item.stockQuantity > 0
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Смета для клиента") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(
                    value = diagnosis,
                    onValueChange = { diagnosis = it.take(2000) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Результат диагностики") },
                    minLines = 3,
                    maxLines = 5,
                )
                Text("Работы и запчасти", fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                LazyColumn(modifier = Modifier.heightIn(max = 260.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
                    itemsIndexed(lines) { index, line ->
                        Column(
                            modifier = Modifier
                                .fillMaxWidth()
                                .background(androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f), RoundedCornerShape(10.dp))
                                .padding(9.dp),
                            verticalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            Text("${itemTypeLabel(line.catalogItem.type)} · ${line.catalogItem.name}", fontSize = 11.sp, fontWeight = FontWeight.Medium)
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("${line.catalogItem.unitPriceRub} ₽ · остаток ${line.catalogItem.stockQuantity?.toString() ?: "не учитывается"}", modifier = Modifier.weight(1f), fontSize = 10.sp, color = UtpMuted)
                                OutlinedTextField(
                                    value = line.quantity,
                                    onValueChange = { value -> lines[index] = line.copy(quantity = value.filter(Char::isDigit).take(2)) },
                                    modifier = Modifier.weight(0.45f),
                                    label = { Text("Кол-во") },
                                    singleLine = true,
                                )
                                TextButton(onClick = { lines.removeAt(index) }) { Text("Убрать") }
                            }
                        }
                    }
                }
                OutlinedButton(
                    onClick = { showCatalog = true },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = selectableItems.any { candidate -> lines.none { it.catalogItem.id == candidate.id } },
                ) { Text("Добавить позицию из каталога") }
                DropdownMenu(expanded = showCatalog, onDismissRequest = { showCatalog = false }) {
                    selectableItems.filter { candidate -> lines.none { it.catalogItem.id == candidate.id } }.forEach { item ->
                        DropdownMenuItem(
                            text = { Text("${itemTypeLabel(item.type)} · ${item.name} · ${item.unitPriceRub} ₽", fontSize = 12.sp) },
                            onClick = {
                                lines.add(DraftLine(item))
                                showCatalog = false
                                validation = null
                            },
                        )
                    }
                }
                validation?.let { Text(it, color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 11.sp) }
                Text("Цена подставляется из каталога. Списание со склада произойдёт только после согласия.", fontSize = 10.sp, lineHeight = 15.sp, color = UtpMuted)
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    if (diagnosis.trim().length < 3 || lines.isEmpty() || lines.any { it.quantity.toIntOrNull() !in 1..99 }) {
                        validation = "Заполните диагностику, добавьте позицию и укажите количество от 1 до 99."
                    } else {
                        onSubmit(
                            diagnosis.trim(),
                            lines.map { RepairEstimateDraftItem(it.catalogItem.id, it.quantity.toInt()) },
                        )
                    }
                },
            ) { Text("Отправить на согласование") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
