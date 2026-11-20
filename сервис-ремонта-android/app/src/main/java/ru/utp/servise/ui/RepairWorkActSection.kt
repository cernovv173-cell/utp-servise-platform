package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.RepairWorkActCatalogShortcuts
import ru.utp.servise.data.RepairWorkActDraftLine
import ru.utp.servise.data.RepairWorkActLine
import ru.utp.servise.data.readRepairWorkActCatalogShortcuts
import ru.utp.servise.data.recordRecentRepairCatalogItem
import ru.utp.servise.data.saveRepairWorkActCatalogShortcuts
import ru.utp.servise.data.toggleRepairCatalogFavorite
import java.util.UUID

private data class ActLineDraft(
    val line: RepairWorkActLine,
)

private fun orderLines(order: RepairOrder): List<RepairWorkActLine> =
    order.items.map { item ->
        RepairWorkActLine(
            lineId = item.id,
            orderItemId = item.id,
            catalogItemId = item.catalogItemId,
            type = item.type,
            name = item.name,
            quantity = item.quantity,
            unitPriceRub = item.unitPriceRub,
        )
    }

private fun visibleActLines(order: RepairOrder): List<RepairWorkActLine> {
    val act = order.workAct ?: return orderLines(order)
    return if (act.status == "APPROVED") act.approvedItemsSnapshot.orEmpty() else act.itemsSnapshot
}

private fun actLineTotal(lines: List<RepairWorkActLine>): Int =
    lines.sumOf { it.quantity * it.unitPriceRub }

@Composable
internal fun RepairWorkActSection(
    order: RepairOrder,
    role: String,
    token: String,
    catalogItems: List<CatalogItem>,
    currentUserId: String,
    runAction: RunAction,
) {
    val act = order.workAct
    val isAssignedTechnician =
        role == "TECHNICIAN" && order.technicianId == currentUserId
    val canManage = isAssignedTechnician
    if (!canManage) return

    val editable = order.status == "IN_PROGRESS" && (act == null || act.status == "DRAFT")
    val draft = remember(order.id, act?.revision, act?.status) {
        mutableStateListOf<ActLineDraft>().apply {
            addAll((act?.itemsSnapshot ?: orderLines(order)).map(::ActLineDraft))
        }
    }
    val selectedIds = remember(order.id, act?.revision, act?.status) {
        mutableStateListOf<String>().apply {
            if (act?.status == "PENDING") addAll(act.itemsSnapshot.map { it.lineId })
        }
    }
    var phoneConsentConfirmed by remember(order.id, act?.revision, act?.status) {
        mutableStateOf(false)
    }
    var catalogExpanded by remember(order.id) { mutableStateOf(false) }
    val context = LocalContext.current.applicationContext
    val shortcutOwnerId = currentUserId.ifBlank { "local" }
    var catalogShortcuts by remember(shortcutOwnerId) {
        mutableStateOf(readRepairWorkActCatalogShortcuts(context, shortcutOwnerId))
    }
    val availableItems = catalogItems.filter { item ->
        item.active && (item.type == "PRODUCT" || order.deviceType in item.deviceTypes)
    }
    val draftLines = draft.map { it.line }
    val addCatalogItem: (CatalogItem) -> Unit = { item ->
        if (draft.size < 100) {
            draft.add(
                ActLineDraft(
                    RepairWorkActLine(
                        lineId = UUID.randomUUID().toString(),
                        orderItemId = null,
                        catalogItemId = item.id,
                        type = item.type,
                        name = item.name,
                        quantity = 1,
                        unitPriceRub = item.unitPriceRub,
                    ),
                ),
            )
            val updated = catalogShortcuts.copy(
                recentIds = recordRecentRepairCatalogItem(catalogShortcuts.recentIds, item.id),
            )
            catalogShortcuts = updated
            saveRepairWorkActCatalogShortcuts(context, shortcutOwnerId, updated)
        }
        catalogExpanded = false
    }
    val toggleFavorite: (String) -> Unit = { itemId ->
        val updated = catalogShortcuts.copy(
            favoriteIds = toggleRepairCatalogFavorite(catalogShortcuts.favoriteIds, itemId),
        )
        catalogShortcuts = updated
        saveRepairWorkActCatalogShortcuts(context, shortcutOwnerId, updated)
    }

    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.tertiaryContainer.copy(alpha = 0.38f),
        ),
    ) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("ФАКТИЧЕСКИЕ РАБОТЫ", fontSize = 10.sp, color = UtpBlue, fontWeight = FontWeight.Bold, letterSpacing = 1.2.sp)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Акт выполненных работ", modifier = Modifier.weight(1f), fontSize = 15.sp, color = UtpInk, fontWeight = FontWeight.SemiBold)
                act?.let {
                    Text(
                        when (it.status) {
                            "DRAFT" -> "Черновик"
                            "PENDING" -> "На проверке"
                            else -> "Подтверждён"
                        },
                        fontSize = 10.sp,
                        color = UtpBlue,
                        fontWeight = FontWeight.SemiBold,
                    )
                }
            }
            Text(
                "Мастер фиксирует выполненные работы, звонит клиенту и сохраняет согласованный состав. До ответа клиента черновик не меняет чек или склад.",
                fontSize = 11.sp,
                color = UtpMuted,
                lineHeight = 16.sp,
            )

            if (act == null && order.status != "IN_PROGRESS" && order.workActRequired) {
                Text("После начала ремонта мастер заполнит акт и согласует итоговые строки с клиентом по телефону.", fontSize = 11.sp, color = UtpMuted)
            }

            if ((act == null || act.status == "DRAFT") && editable) {
                Text("Исходные строки сметы сохранены. Отметьте только те работы, которые клиент подтвердил по телефону.", fontSize = 10.sp, color = UtpMuted)
                draft.forEachIndexed { index, item ->
                    Row(
                        modifier = Modifier.fillMaxWidth().background(
                            androidx.compose.material3.MaterialTheme.colorScheme.surface,
                            RoundedCornerShape(10.dp),
                        ).padding(10.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text("${item.line.name} · ${item.line.quantity} × ${item.line.unitPriceRub} ₽", fontSize = 11.sp, color = UtpInk)
                            Text(itemTypeLabel(item.line.type), fontSize = 10.sp, color = UtpMuted)
                        }
                        if (item.line.orderItemId == null) {
                            OutlinedTextField(
                                value = item.line.quantity.takeIf { it > 0 }?.toString().orEmpty(),
                                onValueChange = { value ->
                                    val quantity = value.filter(Char::isDigit).take(2).toIntOrNull() ?: 0
                                    draft[index] = ActLineDraft(item.line.copy(quantity = quantity))
                                },
                                modifier = Modifier.width(76.dp),
                                label = { Text("Кол-во") },
                                singleLine = true,
                            )
                            TextButton(onClick = { draft.removeAt(index) }) { Text("Убрать") }
                        }
                    }
                }

                Column {
                    OutlinedButton(
                        onClick = { catalogExpanded = true },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = draft.size < 100 && availableItems.isNotEmpty(),
                    ) { Text("Добавить работу или запчасть") }
                }
                Text("Черновик: ${actLineTotal(draftLines)} ₽", modifier = Modifier.fillMaxWidth(), fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = {
                            runAction(
                                {
                                    ApiClient.saveRepairWorkAct(
                                        token,
                                        order.id,
                                        act?.revision ?: 0,
                                        draftLines.map { RepairWorkActDraftLine(it.lineId, it.orderItemId, it.catalogItemId, it.quantity) },
                                    )
                                },
                            ) {}
                        },
                        modifier = Modifier.weight(1f),
                        enabled = draft.isNotEmpty() && draft.all { it.line.quantity in 1..99 },
                    ) { Text("Сохранить черновик") }
                    Button(
                        onClick = {
                            runAction(
                                {
                                    val saved = ApiClient.saveRepairWorkAct(
                                        token,
                                        order.id,
                                        act?.revision ?: 0,
                                        draftLines.map { RepairWorkActDraftLine(it.lineId, it.orderItemId, it.catalogItemId, it.quantity) },
                                    )
                                    ApiClient.submitRepairWorkAct(token, order.id, saved.revision)
                                },
                            ) {}
                        },
                        modifier = Modifier.weight(1f),
                        enabled = draft.isNotEmpty() && draft.all { it.line.quantity in 1..99 },
                    ) { Text("Подготовить акт для звонка") }
                }
            }

            if (act?.status == "DRAFT" && !editable) {
                Text("Черновик ещё не подготовлен для согласования с клиентом.", fontSize = 11.sp, color = UtpMuted)
            }

            if (act?.status == "PENDING" || act?.status == "APPROVED") {
                val lines = if (act.status == "PENDING") act.itemsSnapshot else act.approvedItemsSnapshot.orEmpty()
                lines.forEach { line ->
                    val checked = selectedIds.contains(line.lineId)
                    Row(
                        modifier = Modifier.fillMaxWidth().background(
                            androidx.compose.material3.MaterialTheme.colorScheme.surface,
                            RoundedCornerShape(10.dp),
                        ).padding(horizontal = 8.dp, vertical = 5.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        if (act.status == "PENDING" && isAssignedTechnician) {
                            Checkbox(
                                checked = checked,
                                onCheckedChange = { selected ->
                                    if (selected && !selectedIds.contains(line.lineId)) selectedIds.add(line.lineId)
                                    else if (!selected) selectedIds.remove(line.lineId)
                                },
                            )
                        }
                        Column(Modifier.weight(1f)) {
                            Text(line.name, fontSize = 11.sp, color = UtpInk)
                            Text("${itemTypeLabel(line.type)} · ${line.quantity} × ${line.unitPriceRub} ₽", fontSize = 10.sp, color = UtpMuted)
                        }
                        Text("${line.quantity.toLong() * line.unitPriceRub} ₽", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                    }
                }
                val shownLines = if (act.status == "PENDING" && isAssignedTechnician) lines.filter { selectedIds.contains(it.lineId) } else lines
                Text(
                    "Итого${if (act.status == "PENDING" && isAssignedTechnician) " согласованных строк" else ""}: ${actLineTotal(shownLines)} ₽",
                    modifier = Modifier.fillMaxWidth(),
                    fontSize = 12.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
                if (act.status == "PENDING" && isAssignedTechnician) {
                    Text("Снимите отметки у строк, которые клиент не согласовал по телефону.", fontSize = 10.sp, color = UtpMuted)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(
                            checked = phoneConsentConfirmed,
                            onCheckedChange = { phoneConsentConfirmed = it },
                        )
                        Text("Клиент согласовал выбранный состав и сумму по телефону", fontSize = 11.sp, color = UtpInk)
                    }
                    Button(
                        onClick = {
                            runAction(
                                { ApiClient.reviewRepairWorkAct(token, order.id, act.revision, selectedIds.toList()) },
                            ) {}
                        },
                        modifier = Modifier.fillMaxWidth(),
                        enabled = phoneConsentConfirmed,
                    ) { Text("Зафиксировать согласие по телефону") }
                } else {
                    Text("Подтвердил(а): ${act.approvedByName.orEmpty()}", fontSize = 10.sp, color = UtpMuted)
                    act.removedItemsSnapshot?.takeIf { it.isNotEmpty() }?.let { removed ->
                        Text("Не согласованы по телефону: ${removed.joinToString { it.name }}", fontSize = 10.sp, color = UtpMuted)
                    }
                }
            }
        }
    }

    if (catalogExpanded) {
        RepairWorkActCatalogPickerDialog(
            items = availableItems,
            shortcuts = catalogShortcuts,
            onToggleFavorite = toggleFavorite,
            onAdd = addCatalogItem,
            onDismiss = { catalogExpanded = false },
        )
    }
}

private fun itemTypeLabel(type: String): String = when (type) {
    "SERVICE" -> "Работа"
    "SPARE_PART" -> "Запчасть"
    else -> "Товар"
}
