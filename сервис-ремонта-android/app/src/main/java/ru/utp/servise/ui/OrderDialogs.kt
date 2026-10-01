package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.deviceLabel

private val deviceTypes = listOf("COMPUTER", "LAPTOP", "PHONE", "TABLET")

@Composable
internal fun AssignmentDialog(
    token: String,
    technicians: List<StaffMember>,
    onDismiss: () -> Unit,
    onSelect: (String) -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Назначить мастера") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
                if (technicians.isEmpty()) Text("Сначала добавьте активного мастера в разделе «Сотрудники».")
                technicians.forEach { member ->
                    TextButton(onClick = { onSelect(member.id) }) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RemoteProjectImage(
                                member.avatarObjectId,
                                token = token,
                                modifier = Modifier.size(36.dp).clip(RoundedCornerShape(18.dp)),
                                contentDescription = "Аватар ${member.displayName}",
                            )
                            Column(
                                Modifier.fillMaxWidth().padding(start = 8.dp),
                                horizontalAlignment = Alignment.Start,
                            ) {
                                Text(member.displayName, color = UtpInk, fontWeight = FontWeight.SemiBold)
                                Text(member.email, fontSize = 12.sp, color = UtpMuted)
                            }
                        }
                    }
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Закрыть") } },
    )
}

@Composable
internal fun OrderEditDialog(
    order: RepairOrder,
    onDismiss: () -> Unit,
    onSave: (String, String, String) -> Unit,
) {
    var deviceType by remember(order.id) { mutableStateOf(order.deviceType) }
    var problem by remember(order.id) { mutableStateOf(order.problem) }
    var address by remember(order.id) { mutableStateOf(order.address) }
    var deviceMenu by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Редактировать заказ") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Box {
                    OutlinedButton(
                        onClick = { deviceMenu = true },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text("Устройство: ${deviceType.deviceLabel()}", modifier = Modifier.weight(1f))
                        Text("⌄")
                    }
                    DropdownMenu(expanded = deviceMenu, onDismissRequest = { deviceMenu = false }) {
                        deviceTypes.forEach { item ->
                            DropdownMenuItem(
                                text = { Text(item.deviceLabel()) },
                                onClick = { deviceType = item; deviceMenu = false },
                            )
                        }
                    }
                }
                OutlinedTextField(
                    problem,
                    { problem = it.take(2000) },
                    label = { Text("Неисправность") },
                    modifier = Modifier.fillMaxWidth().height(120.dp),
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(
                    address,
                    { address = it.take(500) },
                    label = { Text("Адрес") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onSave(deviceType, problem.trim(), address.trim()) },
                enabled = problem.trim().length >= 5 && address.trim().length >= 8,
            ) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
