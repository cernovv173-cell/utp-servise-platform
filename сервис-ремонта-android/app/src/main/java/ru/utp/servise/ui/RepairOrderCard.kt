package ru.utp.servise.ui

import android.net.Uri
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CatalogItem
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.RepairOrderItem
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.orderItemTypeLabel
import ru.utp.servise.data.statusLabel
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

private val archiveDateFormatter = DateTimeFormatter.ofPattern(
    "dd.MM.yyyy HH:mm",
    Locale.forLanguageTag("ru-RU"),
)

private fun formatArchiveDate(value: String): String = runCatching {
    Instant.parse(value).atZone(ZoneId.systemDefault()).format(archiveDateFormatter)
}.getOrDefault(value.take(10))

private fun latestEstimateRequiresApproval(order: RepairOrder): Boolean =
    order.estimates.lastOrNull()?.status != "APPROVED"

@Composable
internal fun RepairOrderCard(
    order: RepairOrder,
    role: String,
    token: String,
    technicians: List<StaffMember>,
    catalogItems: List<CatalogItem>,
    runAction: RunAction,
    onChat: (String) -> Unit,
    onReview: (String) -> Unit,
) {
    val context = LocalContext.current
    var showAssignment by remember { mutableStateOf(false) }
    var showAddItem by remember { mutableStateOf(false) }
    var showEdit by remember { mutableStateOf(false) }
    var showPaperwork by remember { mutableStateOf(false) }
    var showReleaseDialog by remember { mutableStateOf(false) }
    var showOrderDetails by remember(order.id) { mutableStateOf(false) }
    var itemPendingRemoval by remember(order.id) { mutableStateOf<RepairOrderItem?>(null) }

    Card(
        Modifier.fillMaxWidth().padding(bottom = 11.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.padding(16.dp)) {
            Text(order.serviceNumber, fontSize = 11.sp, color = UtpBlue, fontWeight = FontWeight.SemiBold)
            ServiceNumberBarcode(order.serviceNumber)
            order.archivedAt?.let { archivedAt ->
                Text(
                    "АРХИВ · ${formatArchiveDate(archivedAt)}",
                    fontSize = 10.sp,
                    color = androidx.compose.material3.MaterialTheme.colorScheme.tertiary,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    order.deviceType.deviceLabel(),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    color = UtpInk,
                    modifier = Modifier.weight(1f),
                )
                OrderStatusPill(order.status.statusLabel())
            }
            val deviceDescription = listOfNotNull(
                order.deviceBrand?.takeIf { it.isNotBlank() },
                order.deviceModel?.takeIf { it.isNotBlank() },
            ).joinToString(" · ")
            if (deviceDescription.isNotBlank() || !order.deviceSerialNumber.isNullOrBlank()) {
                Text(
                    listOfNotNull(
                        deviceDescription.takeIf { it.isNotBlank() },
                        order.deviceSerialNumber?.takeIf { it.isNotBlank() }?.let { "Сер. № $it" },
                    ).joinToString(" · "),
                    fontSize = 11.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 3.dp),
                )
            }
            Text(order.problem, fontSize = 13.sp, color = UtpInk, modifier = Modifier.padding(top = 9.dp))
            order.repairLocation?.let { location ->
                Text(
                    "Место ремонта: ${if (location == "SERVICE_CENTER") "в сервисном центре" else "у клиента"}",
                    fontSize = 11.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (order.preferredAt != null) {
                Text(
                    "Желаемое время: ${formatArchiveDate(order.preferredAt)} · сервис подтвердит отдельно",
                    fontSize = 11.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 2.dp)) {
                Text(
                    if (order.priority == "URGENT") "Срочный приоритет" else "Обычный приоритет",
                    fontSize = 11.sp,
                    color = if (order.priority == "URGENT") androidx.compose.material3.MaterialTheme.colorScheme.error else UtpMuted,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                )
                if (role == "ADMIN") {
                    TextButton(
                        onClick = {
                            runAction({
                                ApiClient.updateRepairPriority(
                                    token,
                                    order.id,
                                    if (order.priority == "URGENT") "NORMAL" else "URGENT",
                                )
                            }) {}
                        },
                    ) {
                        Text(if (order.priority == "URGENT") "Снять срочность" else "Сделать срочной")
                    }
                }
            }
            RepairEstimateSection(order, role, token, catalogItems, runAction)
            RepairWorkActSection(order, role, token, catalogItems, runAction)
            RepairDeadlineSection(order, role, token, runAction)
            TextButton(
                onClick = { showOrderDetails = !showOrderDetails },
                modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
            ) {
                Text(if (showOrderDetails) "Скрыть подробности, фото и историю" else "Подробности, фото и история")
            }
            if (showOrderDetails) {
            val structuredAddress = listOfNotNull(
                order.city,
                order.street,
                order.house?.let { "д. $it" },
                order.apartment?.takeIf { it.isNotBlank() }?.let { "кв. $it" },
                order.entrance?.takeIf { it.isNotBlank() }?.let { "подъезд $it" },
                order.floor?.takeIf { it.isNotBlank() }?.let { "этаж $it" },
                if (order.hasBarrier) "шлагбаум: да" else "шлагбаум: нет",
                order.additionalInfo?.takeIf { it.isNotBlank() },
            ).joinToString(", ")
            Text(structuredAddress.ifBlank { order.address }, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
            order.contactPhone?.takeIf { it.isNotBlank() }?.let {
                Text("Телефон для связи: $it", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp))
            }
            order.additionalPhone?.takeIf { it.isNotBlank() }?.let {
                Text("Дополнительный телефон: $it", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp))
            }

            if (role == "ADMIN" || role == "TECHNICIAN") {
                Row(
                    modifier = Modifier.padding(top = 7.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RemoteProjectImage(
                        order.customerAvatarObjectId,
                        token,
                        Modifier.size(36.dp).clip(RoundedCornerShape(18.dp)),
                        "Аватар клиента",
                    )
                    Text(
                        "Клиент: ${order.customerName.ifBlank { "—" }}",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
                order.customerPhoneNumber?.takeIf { it.isNotBlank() }?.let {
                    Text("Телефон клиента: $it", fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(top = 3.dp))
                }
            }
            if (order.technicianName.isNotBlank()) {
                Row(
                    modifier = Modifier.padding(top = 5.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    RemoteProjectImage(
                        order.technicianAvatarObjectId,
                        token,
                        Modifier.size(36.dp).clip(RoundedCornerShape(18.dp)),
                        "Аватар мастера",
                    )
                    Text(
                        "Мастер: ${order.technicianName}",
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(start = 8.dp),
                    )
                }
                if (role == "CUSTOMER" || role == "ADMIN") {
                    if (role == "CUSTOMER" && order.technicianId != null) {
                        TextButton(onClick = { onChat("technician-profile:${order.technicianId}") }) {
                            Text("Карточка мастера")
                        }
                    }
                    order.technicianPhoneNumber?.takeIf { it.isNotBlank() }?.let {
                        Text("Телефон мастера: $it", fontSize = 12.sp, color = UtpBlue, modifier = Modifier.padding(top = 3.dp))
                    }
                }
            }

            if (order.photos.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Text("Фотографии заказа", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                order.photos.forEachIndexed { index, photo ->
                    RemoteProjectImage(
                        photo.objectId,
                        token,
                        Modifier.fillMaxWidth().height(190.dp).padding(top = 7.dp),
                        "Фото ${index + 1} к заказу",
                    )
                    if (role == "CUSTOMER" && order.status == "COMPLETED" && order.technicianId != null) {
                        TextButton(onClick = {
                            runAction({ ApiClient.setPortfolioConsent(token, order.id, photo.id, photo.portfolioConsentAt == null) }) { }
                        }) {
                            Text(if (photo.portfolioConsentAt == null) "Разрешить показать в работах мастера" else "Отозвать согласие на показ")
                        }
                    }
                }
            }
            PhotoPickerButton("Добавить фото к заказу") { uri: Uri ->
                runAction({
                    ApiClient.uploadOrderPhoto(
                        token,
                        order.id,
                        compressSelectedImage(context, uri),
                    )
                }) {}
            }
            }

            if (order.items.isNotEmpty()) {
                Spacer(Modifier.height(11.dp))
                Text("Услуги и запчасти", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                order.items.forEach { item ->
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Column(Modifier.weight(1f)) {
                            Text(item.name, fontSize = 12.sp, color = UtpInk)
                            Text("${item.type.orderItemTypeLabel()} · ${item.quantity} × ${item.unitPriceRub} ₽", fontSize = 10.sp, color = UtpMuted)
                        }
                        Text("${item.quantity.toLong() * item.unitPriceRub} ₽", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        val canRemoveItem =
                            role == "ADMIN" &&
                                order.estimates.isEmpty() &&
                                order.status in listOf(
                                    "REQUESTED",
                                    "ASSIGNED",
                                    "IN_PROGRESS",
                                    "READY_FOR_PICKUP",
                                ) &&
                                order.receipt?.paymentStatus != "PAID"
                        if (canRemoveItem) {
                            TextButton(onClick = { itemPendingRemoval = item }) {
                                Text(
                                    "Удалить",
                                    color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                                    fontSize = 11.sp,
                                )
                            }
                        }
                    }
                }
                val totalRub = order.items.sumOf { it.quantity.toLong() * it.unitPriceRub }
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text("Сумма позиций", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.weight(1f))
                    Text("$totalRub ₽", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
                }
            }
            if (order.history.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Text("История статусов", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                order.history.forEach { event ->
                    Text("• $event", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp))
                }
            }

            RepairReceiptPanel(order, role, token, runAction)

            OutlinedButton(
                onClick = { showPaperwork = true },
                modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                shape = RoundedCornerShape(12.dp),
            ) { Text("Акт приёма · заказ-наряд · гарантия") }
            if (role in listOf("ADMIN", "TECHNICIAN") && order.status == "READY_FOR_PICKUP") {
                Button(
                    onClick = { showReleaseDialog = true },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Выдать заказ") }
            }

            val actions = mutableListOf<Pair<String, String>>()
            when (role) {
                "CUSTOMER" -> if (order.status == "REQUESTED") actions.add("Отменить заявку" to "CANCELLED")
                "TECHNICIAN" -> when (order.status) {
                    "ASSIGNED" -> actions.add("Начать ремонт" to "IN_PROGRESS")
                    "IN_PROGRESS" -> actions.add("Готов к выдаче" to "READY_FOR_PICKUP")
                }
                "ADMIN" -> when (order.status) {
                    "ASSIGNED" -> actions.add("Начать ремонт" to "IN_PROGRESS")
                    "IN_PROGRESS" -> {
                        actions.add("Готов к выдаче" to "READY_FOR_PICKUP")
                        actions.add("Отменить" to "CANCELLED")
                    }
                    "REQUESTED" -> actions.add("Отменить" to "CANCELLED")
                }
            }

            val canEdit =
                (order.status == "REQUESTED" && role in listOf("CUSTOMER", "ADMIN")) ||
                    (role == "ADMIN" && order.status in listOf(
                        "ASSIGNED",
                        "IN_PROGRESS",
                        "READY_FOR_PICKUP",
                        "COMPLETED",
                    ))
            if (canEdit) {
                OutlinedButton(
                    onClick = { showEdit = true },
                    modifier = Modifier.fillMaxWidth().padding(top = 9.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Редактировать заказ") }
            }
            if (role == "ADMIN" && order.status in listOf("REQUESTED", "ASSIGNED")) {
                OutlinedButton(
                    onClick = { showAssignment = true },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text(if (order.technicianName.isBlank()) "Назначить мастера" else "Сменить мастера") }
            }
            if (
                role in listOf("ADMIN", "TECHNICIAN") &&
                !order.workActRequired &&
                order.workAct == null &&
                order.estimates.isEmpty() &&
                order.status in listOf("REQUESTED", "ASSIGNED", "IN_PROGRESS", "READY_FOR_PICKUP")
            ) {
                OutlinedButton(
                    onClick = { showAddItem = true },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Добавить услугу или запчасть") }
            }
            if (
                role in listOf("ADMIN", "TECHNICIAN") &&
                order.status in listOf("ASSIGNED", "IN_PROGRESS") &&
                order.diagnosisCompletedAt == null
            ) {
                OutlinedButton(
                    onClick = {
                        runAction({ ApiClient.completeRepairDiagnosis(token, order.id) }, {})
                    },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Диагностика завершена") }
            }
            if (role == "CUSTOMER" || role == "TECHNICIAN") {
                OutlinedButton(
                    onClick = { onChat(order.id) },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Открыть чат по заказу") }
            }
            actions.forEach { (label, status) ->
                val estimateBlocksAction = when (status) {
                    "IN_PROGRESS" -> order.estimates.isNotEmpty() && latestEstimateRequiresApproval(order)
                    "READY_FOR_PICKUP" -> order.estimates.lastOrNull()?.status == "PENDING"
                    else -> false
                }
                val workActBlocksAction = status == "READY_FOR_PICKUP" &&
                    (order.workActRequired || order.workAct != null) &&
                    order.workAct?.status != "APPROVED"
                OutlinedButton(
                    onClick = { runAction({ ApiClient.updateStatus(token, order.id, status) }, {}) },
                    enabled = !estimateBlocksAction && !workActBlocksAction,
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(
                        when {
                            workActBlocksAction -> "Ожидает подтверждения акта администратором"
                            estimateBlocksAction -> "Ожидает подтверждения администратора"
                            else -> label
                        },
                    )
                }
            }
            if (role == "CUSTOMER" && order.status == "COMPLETED") {
                RepairCompletionCard(order = order, onReview = onReview)
            }
        }
    }

    if (showAssignment) {
        AssignmentDialog(
            token = token,
            technicians = technicians.filter { it.role == "TECHNICIAN" && it.active },
            onDismiss = { showAssignment = false },
            onSelect = { technicianId ->
                showAssignment = false
                runAction({ ApiClient.assignTechnician(token, order.id, technicianId) }, {})
            },
        )
    }
    if (showAddItem) {
        OrderItemPickerDialog(
            catalogItems = catalogItems.filter { item ->
                item.active && (item.type == "PRODUCT" || order.deviceType in item.deviceTypes)
            },
            onDismiss = { showAddItem = false },
            onAdd = { catalogItemId, quantity ->
                runAction({ ApiClient.addOrderItem(token, order.id, catalogItemId, quantity) }) {
                    showAddItem = false
                }
            },
        )
    }
    if (showEdit) {
        OrderEditDialog(
            order = order,
            onDismiss = { showEdit = false },
            onSave = { deviceType, problem, address ->
                runAction({ ApiClient.updateOrder(token, order.id, deviceType, problem, address) }) {
                    showEdit = false
                }
            },
        )
    }
    if (showPaperwork) {
        OrderPaperworkDialog(order, role, token, runAction) { showPaperwork = false }
    }
    if (showReleaseDialog) {
        RepairOrderReleaseDialog(order, token, runAction) { showReleaseDialog = false }
    }
    itemPendingRemoval?.let { item ->
        AlertDialog(
            onDismissRequest = { itemPendingRemoval = null },
            title = { Text("Удалить позицию из заказа?") },
            text = {
                Text(
                    "${item.name} — ${item.quantity} шт. Складской остаток будет возвращён, " +
                        "если он учитывается.",
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        itemPendingRemoval = null
                        runAction({ ApiClient.removeOrderItem(token, order.id, item.id) }, {})
                    },
                ) { Text("Удалить") }
            },
            dismissButton = {
                TextButton(onClick = { itemPendingRemoval = null }) { Text("Отмена") }
            },
        )
    }
}
