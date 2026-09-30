package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
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
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CustomerReview
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.statusLabel
import ru.utp.servise.data.orderItemTypeLabel

typealias RunAction = (suspend () -> Any?, (Any?) -> Unit) -> Unit

@Composable
fun RepairOrdersScreen(
    title: String,
    orders: List<RepairOrder>,
    role: String,
    token: String,
    technicians: List<StaffMember>,
    historyOnly: Boolean,
    runAction: RunAction,
    refresh: () -> Unit,
    onReview: (String) -> Unit,
) {
    val visibleOrders = if (historyOnly) orders.filter { it.status == "COMPLETED" || it.status == "CANCELLED" }
        else orders.filter { it.status != "COMPLETED" && it.status != "CANCELLED" }
    Column(Modifier.fillMaxSize().background(UtpPale).padding(horizontal = 18.dp, vertical = 14.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Column(Modifier.weight(1f)) {
                Text(title, fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                Text("${visibleOrders.size} заявок", fontSize = 12.sp, color = UtpMuted)
            }
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        Spacer(Modifier.height(10.dp))
        if (visibleOrders.isEmpty()) {
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
                Text(if (historyOnly) "Завершённых ремонтов пока нет." else "Сейчас здесь нет заявок.", Modifier.padding(18.dp), color = UtpMuted)
            }
        }
        visibleOrders.forEach { order ->
            RepairOrderCard(order, role, token, technicians, runAction, onReview)
        }
    }
}

@Composable
private fun RepairOrderCard(
    order: RepairOrder,
    role: String,
    token: String,
    technicians: List<StaffMember>,
    runAction: RunAction,
    onReview: (String) -> Unit,
) {
    var showAssignment by remember { mutableStateOf(false) }
    var showAddItem by remember { mutableStateOf(false) }
    Card(Modifier.fillMaxWidth().padding(bottom = 11.dp), shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(order.deviceType.deviceLabel(), fontWeight = FontWeight.SemiBold, fontSize = 16.sp, color = UtpInk, modifier = Modifier.weight(1f))
                StatusPill(order.status.statusLabel())
            }
            Text(order.problem, fontSize = 13.sp, color = UtpInk, modifier = Modifier.padding(top = 9.dp))
            Text(order.address, fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
            if (role == "ADMIN") Text("Клиент: ${order.customerName.ifBlank { "—" }}", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 7.dp))
            if (order.technicianName.isNotBlank()) Text("Мастер: ${order.technicianName}", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(top = 4.dp))
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
                order.history.forEach { event -> Text("• $event", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp)) }
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
            if ((role == "ADMIN" && order.status in listOf("REQUESTED", "ASSIGNED"))) {
                OutlinedButton(onClick = { showAssignment = true }, modifier = Modifier.fillMaxWidth().padding(top = 11.dp), shape = RoundedCornerShape(12.dp)) {
                    Text(if (order.technicianName.isBlank()) "Назначить мастера" else "Сменить мастера")
                }
            }
            if (role == "ADMIN" || role == "TECHNICIAN") {
                OutlinedButton(
                    onClick = { showAddItem = true },
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Добавить услугу или запчасть") }
            }
            actions.forEach { (label, status) ->
                OutlinedButton(
                    onClick = { runAction({ ru.utp.servise.data.ApiClient.updateStatus(token, order.id, status) }, {}) },
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
            technicians = technicians.filter { it.role == "TECHNICIAN" && it.active },
            onDismiss = { showAssignment = false },
            onSelect = { technicianId ->
                showAssignment = false
                runAction({ ru.utp.servise.data.ApiClient.assignTechnician(token, order.id, technicianId) }, {})
            },
        )
    }
    if (showAddItem) {
        OrderItemDialog(
            onDismiss = { showAddItem = false },
            onAdd = { type, name, quantity, unitPriceRub ->
                runAction({
                    ru.utp.servise.data.ApiClient.addOrderItem(
                        token, order.id, type, name, quantity, unitPriceRub,
                    )
                }) { showAddItem = false }
            },
        )
    }
}

@Composable
private fun OrderItemDialog(
    onDismiss: () -> Unit,
    onAdd: (String, String, Int, Int) -> Unit,
) {
    var type by remember { mutableStateOf("SERVICE") }
    var name by remember { mutableStateOf("") }
    var quantity by remember { mutableStateOf("1") }
    var price by remember { mutableStateOf("") }
    val parsedQuantity = quantity.toIntOrNull()
    val parsedPrice = price.toIntOrNull()
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Добавить в заказ") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    OutlinedButton(onClick = { type = "SERVICE" }) { Text(if (type == "SERVICE") "✓ Услуга" else "Услуга") }
                    OutlinedButton(onClick = { type = "SPARE_PART" }) { Text(if (type == "SPARE_PART") "✓ Запчасть" else "Запчасть") }
                }
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text(if (type == "SERVICE") "Название услуги" else "Название запчасти") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = quantity,
                    onValueChange = { quantity = it.filter(Char::isDigit).take(2) },
                    label = { Text("Количество (1–99)") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    value = price,
                    onValueChange = { price = it.filter(Char::isDigit).take(8) },
                    label = { Text("Цена за единицу, ₽") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
                Text("Сумма позиции будет видна в карточке заказа.", fontSize = 11.sp, color = UtpMuted)
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onAdd(type, name.trim(), parsedQuantity!!, parsedPrice!!) },
                enabled = name.trim().length >= 2 && parsedQuantity != null && parsedQuantity in 1..99 &&
                    parsedPrice != null && parsedPrice in 0..10_000_000,
            ) { Text("Добавить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

@Composable
private fun AssignmentDialog(technicians: List<StaffMember>, onDismiss: () -> Unit, onSelect: (String) -> Unit) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Назначить мастера") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                if (technicians.isEmpty()) Text("Сначала добавьте активного мастера в разделе «Сотрудники».")
                technicians.forEach { member ->
                    TextButton(onClick = { onSelect(member.id) }) {
                        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.Start) {
                            Text(member.displayName, color = UtpInk, fontWeight = FontWeight.SemiBold)
                            Text(member.email, fontSize = 12.sp, color = UtpMuted)
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Закрыть") } },
    )
}

@Composable
private fun StatusPill(text: String) {
    Box(Modifier.background(androidx.compose.ui.graphics.Color(0xFFEAF2FE), RoundedCornerShape(30.dp)).padding(horizontal = 10.dp, vertical = 5.dp)) {
        Text(text, fontSize = 10.sp, color = UtpBlue, fontWeight = FontWeight.Medium)
    }
}

@Composable
fun ReviewFormScreen(orderId: String, token: String, runAction: RunAction, onDone: () -> Unit) {
    var rating by remember { mutableStateOf(5) }
    var comment by remember { mutableStateOf("") }
    Column(Modifier.fillMaxSize().background(UtpPale).padding(20.dp)) {
        Text("Отзыв о ремонте", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Оцените завершённый заказ", color = UtpMuted, modifier = Modifier.padding(top = 5.dp, bottom = 12.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(5.dp)) {
            (1..5).forEach { value -> TextButton(onClick = { rating = value }) { Text(if (value <= rating) "★" else "☆", fontSize = 25.sp, color = UtpBlue) } }
        }
        OutlinedTextField(comment, { comment = it }, label = { Text("Комментарий") }, modifier = Modifier.fillMaxWidth().height(145.dp), shape = RoundedCornerShape(14.dp))
        Button(
            onClick = {
                runAction({ ru.utp.servise.data.ApiClient.createReview(token, orderId, rating, comment.trim()) }) { onDone() }
            },
            modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
            enabled = comment.trim().length >= 3,
            shape = RoundedCornerShape(13.dp),
        ) { Text("Опубликовать отзыв") }
    }
}

@Composable
fun ReviewsScreen(title: String, reviews: List<CustomerReview>, refresh: () -> Unit) {
    Column(Modifier.fillMaxSize().background(UtpPale).padding(18.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(title, fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk, modifier = Modifier.weight(1f))
            TextButton(onClick = refresh) { Text("Обновить") }
        }
        Text("${reviews.size} отзывов", fontSize = 12.sp, color = UtpMuted, modifier = Modifier.padding(bottom = 10.dp))
        if (reviews.isEmpty()) Text("Отзывов пока нет.", color = UtpMuted)
        reviews.forEach { review ->
            Card(Modifier.fillMaxWidth().padding(bottom = 10.dp), shape = RoundedCornerShape(17.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.ui.graphics.Color.White)) {
                Column(Modifier.padding(15.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("★ ${review.rating}/5", fontWeight = FontWeight.Bold, color = UtpBlue, modifier = Modifier.weight(1f))
                        Text(review.deviceType.deviceLabel(), fontSize = 12.sp, color = UtpMuted)
                    }
                    Text(review.comment, fontSize = 14.sp, color = UtpInk, modifier = Modifier.padding(top = 8.dp))
                    Text("${review.customerName}${review.technicianName.takeIf { it.isNotBlank() }?.let { " · Мастер: $it" }.orEmpty()}", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 9.dp))
                }
            }
        }
    }
}
