package ru.utp.servise.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
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
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.orderItemTypeLabel
import ru.utp.servise.data.statusLabel

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

    Card(
        Modifier.fillMaxWidth().padding(bottom = 11.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    order.deviceType.deviceLabel(),
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 16.sp,
                    color = UtpInk,
                    modifier = Modifier.weight(1f),
                )
                StatusPill(order.status.statusLabel())
            }
            Text(order.problem, fontSize = 13.sp, color = UtpInk, modifier = Modifier.padding(top = 9.dp))
            Text(order.address, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))

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

            val actions = mutableListOf<Pair<String, String>>()
            when (role) {
                "CUSTOMER" -> if (order.status == "REQUESTED") actions.add("Отменить заявку" to "CANCELLED")
                "TECHNICIAN" -> when (order.status) {
                    "ASSIGNED" -> actions.add("Начать ремонт" to "IN_PROGRESS")
                    "IN_PROGRESS" -> actions.add("Завершить ремонт" to "COMPLETED")
                }
                "ADMIN" -> when (order.status) {
                    "ASSIGNED" -> actions.add("Начать ремонт" to "IN_PROGRESS")
                    "IN_PROGRESS" -> {
                        actions.add("Завершить ремонт" to "COMPLETED")
                        actions.add("Отменить" to "CANCELLED")
                    }
                    "REQUESTED" -> actions.add("Отменить" to "CANCELLED")
                }
            }

            val canEdit = order.status == "REQUESTED" && role in listOf("CUSTOMER", "ADMIN") ||
                order.status == "ASSIGNED" && role == "ADMIN"
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
            if (role == "ADMIN" || role == "TECHNICIAN") {
                OutlinedButton(
                    onClick = { showAddItem = true },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Добавить услугу или запчасть") }
            }
            if (role == "CUSTOMER" || role == "TECHNICIAN") {
                OutlinedButton(
                    onClick = { onChat(order.id) },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Открыть чат по заказу") }
            }
            actions.forEach { (label, status) ->
                OutlinedButton(
                    onClick = { runAction({ ApiClient.updateStatus(token, order.id, status) }, {}) },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text(label) }
            }
            if (role == "CUSTOMER" && order.status == "COMPLETED" && !order.hasReview) {
                Button(onClick = { onReview(order.id) }, modifier = Modifier.fillMaxWidth().padding(top = 8.dp), shape = RoundedCornerShape(12.dp)) { Text("Оставить отзыв") }
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
            catalogItems = catalogItems.filter { it.active },
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
}

@Composable
private fun StatusPill(text: String) {
    Box(
        Modifier.background(
            androidx.compose.ui.graphics.Color(0xFFEAF2FE),
            RoundedCornerShape(30.dp),
        ).padding(horizontal = 10.dp, vertical = 5.dp),
    ) {
        Text(text, fontSize = 10.sp, color = UtpBlue, fontWeight = FontWeight.Medium)
    }
}
