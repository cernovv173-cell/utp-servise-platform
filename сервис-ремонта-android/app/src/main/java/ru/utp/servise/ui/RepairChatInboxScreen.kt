package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.deviceLabel

@Composable
internal fun RepairChatInboxScreen(
    orders: List<RepairOrder>,
    role: String,
    onRefresh: () -> Unit,
    onOpenChat: (String) -> Unit,
    onBack: () -> Unit,
) {
    var showArchived by remember { mutableStateOf(false) }
    val visibleOrders = remember(orders, showArchived) {
        orders.filter { (it.archivedAt != null) == showArchived }
            .sortedByDescending { it.createdAt }
    }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(start = 16.dp, top = 8.dp, end = 16.dp, bottom = 20.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text("←  Назад") }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    Text("Чаты по заявкам", fontSize = 24.sp, fontWeight = FontWeight.Bold, color = UtpInk)
                    Text(
                        when (role) {
                            "ADMIN" -> "Переписки клиентов и мастеров по заявкам."
                            "TECHNICIAN" -> "Переписки по назначенным вам ремонтам."
                            else -> "Выберите заявку, чтобы написать по ремонту."
                        },
                        fontSize = 12.sp,
                        color = UtpMuted,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
                TextButton(onClick = onRefresh) { Text("Обновить") }
            }
            Row(Modifier.fillMaxWidth().padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!showArchived) {
                    Button(
                        onClick = { showArchived = false },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Активные")
                    }
                } else {
                    OutlinedButton(
                        onClick = { showArchived = false },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Активные")
                    }
                }
                if (showArchived) {
                    Button(
                        onClick = { showArchived = true },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Архив")
                    }
                } else {
                    OutlinedButton(
                        onClick = { showArchived = true },
                        modifier = Modifier.weight(1f),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Архив")
                    }
                }
            }
        }
        if (visibleOrders.isEmpty()) {
            item {
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(15.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                ) {
                    Text(
                        if (showArchived) {
                            "В архиве пока нет заявок."
                        } else {
                            "Активных заявок для переписки пока нет."
                        },
                        modifier = Modifier.padding(16.dp),
                        fontSize = 13.sp,
                        color = UtpMuted,
                    )
                }
            }
        }
        items(visibleOrders, key = { it.id }) { order ->
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(
                            order.serviceNumber.ifBlank { order.deviceType.deviceLabel() },
                            modifier = Modifier.weight(1f),
                            fontWeight = FontWeight.SemiBold,
                            color = UtpInk,
                        )
                        Text(
                            order.status.replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() },
                            fontSize = 10.sp,
                            color = UtpBlue,
                        )
                    }
                    if (role == "ADMIN") {
                        Text(
                            "Клиент: ${order.customerName.ifBlank { "—" }}",
                            fontSize = 11.sp,
                            color = UtpMuted,
                        )
                    }
                    Text(order.problem.ifBlank { "Заявка на ремонт" }, fontSize = 12.sp, color = UtpMuted)
                    Button(
                        onClick = { onOpenChat(order.id) },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Открыть чат")
                    }
                }
            }
        }
    }
}
