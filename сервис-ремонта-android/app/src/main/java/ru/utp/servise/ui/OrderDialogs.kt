package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Switch
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
import ru.utp.servise.data.OrderAddress
import ru.utp.servise.data.StaffMember
import ru.utp.servise.data.deviceLabel

private val deviceTypes = listOf("COMPUTER", "LAPTOP")

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
                            UserAvatar(
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
    onSave: (String, String, OrderAddress) -> Unit,
) {
    var deviceType by remember(order.id) { mutableStateOf(order.deviceType) }
    var problem by remember(order.id) { mutableStateOf(order.problem) }
    var contactPhone by remember(order.id) { mutableStateOf(order.contactPhone.orEmpty()) }
    var city by remember(order.id) { mutableStateOf(order.city.orEmpty()) }
    var street by remember(order.id) { mutableStateOf(order.street.orEmpty()) }
    var house by remember(order.id) { mutableStateOf(order.house.orEmpty()) }
    var apartment by remember(order.id) { mutableStateOf(order.apartment.orEmpty()) }
    var entrance by remember(order.id) { mutableStateOf(order.entrance.orEmpty()) }
    var hasBarrier by remember(order.id) { mutableStateOf(order.hasBarrier) }
    var floor by remember(order.id) { mutableStateOf(order.floor.orEmpty()) }
    var additionalPhone by remember(order.id) { mutableStateOf(order.additionalPhone.orEmpty()) }
    var additionalInfo by remember(order.id) { mutableStateOf(order.additionalInfo.orEmpty()) }
    var deviceMenu by remember { mutableStateOf(false) }
    val editableDeviceTypes = deviceTypes + listOf(order.deviceType).filterNot(deviceTypes::contains)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Редактировать заказ") },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 460.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
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
                        editableDeviceTypes.forEach { item ->
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
                    contactPhone,
                    { contactPhone = it.take(32) },
                    label = { Text("Телефон клиента *") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                )
                OutlinedTextField(city, { city = it.take(120) }, label = { Text("Город *") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(street, { street = it.take(180) }, label = { Text("Улица *") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(house, { house = it.take(30) }, label = { Text("Дом *") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(apartment, { apartment = it.take(30) }, label = { Text("Квартира") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(entrance, { entrance = it.take(30) }, label = { Text("Подъезд") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(floor, { floor = it.take(20) }, label = { Text("Этаж") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                OutlinedTextField(additionalPhone, { additionalPhone = it.take(32) }, label = { Text("Дополнительный телефон") }, modifier = Modifier.fillMaxWidth(), singleLine = true, shape = RoundedCornerShape(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text("Есть шлагбаум", modifier = Modifier.weight(1f))
                    Switch(checked = hasBarrier, onCheckedChange = { hasBarrier = it })
                    Text(if (hasBarrier) "Да" else "Нет", modifier = Modifier.padding(start = 8.dp))
                }
                OutlinedTextField(
                    additionalInfo,
                    { additionalInfo = it.take(500) },
                    label = { Text("Дополнительная информация") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = {
                    onSave(
                        deviceType,
                        problem.trim(),
                        OrderAddress(contactPhone.trim(), city.trim(), street.trim(), house.trim(), apartment.trim(), entrance.trim(), hasBarrier, floor.trim(), additionalPhone.trim(), additionalInfo.trim()),
                    )
                },
                enabled = problem.trim().length >= 5 && contactPhone.count(Char::isDigit) >= 7 && city.trim().length >= 2 && street.trim().length >= 2 && house.isNotBlank(),
            ) { Text("Сохранить") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}
