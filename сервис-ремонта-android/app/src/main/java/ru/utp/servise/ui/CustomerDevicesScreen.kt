package ru.utp.servise.ui

import android.app.DatePickerDialog
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.CustomerDevice
import ru.utp.servise.data.CustomerDeviceRepair
import ru.utp.servise.data.deviceLabel
import java.time.LocalDate
import java.time.ZoneId
import java.time.Instant

private val deviceTypes = listOf("COMPUTER", "LAPTOP", "MONOBLOCK")

@Composable
fun CustomerDevicesScreen(
    devices: List<CustomerDevice>,
    onRepeat: (String) -> Unit,
    onCreate: (String, String, String, String, String, String?, String) -> Unit,
    onWarrantyClaim: (String, String) -> Unit,
    onSaveReminder: (String, String?, String) -> Unit,
    onDelete: (String) -> Unit,
    busy: Boolean,
    isBusiness: Boolean = false,
    onBack: (() -> Unit)? = null,
) {
    var deviceType by remember { mutableStateOf(deviceTypes.first()) }
    var typeMenu by remember { mutableStateOf(false) }
    var nickname by remember { mutableStateOf("") }
    var brand by remember { mutableStateOf("") }
    var model by remember { mutableStateOf("") }
    var serialNumber by remember { mutableStateOf("") }
    var maintenanceDate by remember { mutableStateOf("") }
    var maintenanceNote by remember { mutableStateOf("") }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        onBack?.let { back -> TextButton(onClick = back) { Text("← Назад") } }
        Text(
            if (isBusiness) "Техника компании" else "Моя техника",
            fontSize = 26.sp,
            fontWeight = FontWeight.Bold,
            color = UtpInk,
        )
        Text(
            if (isBusiness) {
                "Список компании отделён от личной техники. Создавайте корпоративные заявки прямо из карточки устройства."
            } else {
                "Сохраните устройство, чтобы повторная заявка и история ремонта всегда были под рукой."
            },
            fontSize = 13.sp,
            color = UtpMuted,
        )
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                Text(
                    if (isBusiness) "Добавить технику компании" else "Добавить устройство",
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
                Box {
                    OutlinedButton(onClick = { typeMenu = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                        Text(deviceType.deviceLabel(), modifier = Modifier.weight(1f))
                        Text("⌄")
                    }
                    DropdownMenu(expanded = typeMenu, onDismissRequest = { typeMenu = false }) {
                        deviceTypes.forEach { type ->
                            DropdownMenuItem(text = { Text(type.deviceLabel()) }, onClick = { deviceType = type; typeMenu = false })
                        }
                    }
                }
                DeviceTextField(nickname, { nickname = it.take(120) }, "Название для себя (необязательно)")
                DeviceTextField(brand, { brand = it.take(120) }, "Марка")
                DeviceTextField(model, { model = it.take(160) }, "Модель")
                DeviceTextField(serialNumber, { serialNumber = it.take(160) }, "Серийный номер (если известен)")
                Text("Напомнить об обслуживании", fontWeight = FontWeight.SemiBold, color = UtpInk)
                MaintenanceDatePicker(maintenanceDate) { maintenanceDate = it }
                DeviceTextField(maintenanceNote, { maintenanceNote = it.take(250) }, "Что нужно проверить (необязательно)")
                Text(
                    if (isBusiness) {
                        "Напоминание относится к этому устройству компании и будет отправлено ответственному аккаунту."
                    } else {
                        "В срок напомним в приложении и отправим push, если на телефоне включены уведомления."
                    },
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
                Button(
                    enabled = !busy,
                    onClick = { onCreate(deviceType, nickname.trim(), brand.trim(), model.trim(), serialNumber.trim(), maintenanceDate.ifBlank { null }, maintenanceNote.trim()) },
                    modifier = Modifier.fillMaxWidth().height(48.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(
                        if (busy) "Сохраняем…"
                        else if (isBusiness) "Добавить технику компании"
                        else "Добавить технику",
                    )
                }
            }
        }
        if (devices.isEmpty()) {
            Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text(
                    if (isBusiness) "Техники компании пока нет." else "Сохранённых устройств пока нет.",
                    Modifier.padding(16.dp),
                    color = UtpMuted,
                )
            }
        }
        devices.forEach { device ->
            DeviceCard(
                device = device,
                onRepeat = { onRepeat(device.id) },
                onWarrantyClaim = onWarrantyClaim,
                onSaveReminder = { date, note -> onSaveReminder(device.id, date, note) },
                onDelete = { onDelete(device.id) },
                busy = busy,
                isBusiness = isBusiness,
            )
        }
    }
}

@Composable
private fun DeviceCard(
    device: CustomerDevice,
    onRepeat: () -> Unit,
    onWarrantyClaim: (String, String) -> Unit,
    onSaveReminder: (String?, String) -> Unit,
    onDelete: () -> Unit,
    busy: Boolean,
    isBusiness: Boolean,
) {
    var date by remember(device.id, device.nextMaintenanceAt) { mutableStateOf(device.nextMaintenanceAt?.take(10).orEmpty()) }
    var note by remember(device.id, device.maintenanceNote) { mutableStateOf(device.maintenanceNote.orEmpty()) }
    var confirmDelete by remember { mutableStateOf(false) }
    var warrantyClaimOrder by remember { mutableStateOf<CustomerDeviceRepair?>(null) }
    var warrantyClaimProblem by remember { mutableStateOf("") }
    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text(if (isBusiness) "Удалить технику компании?" else "Удалить устройство?") },
            text = {
                Text(
                    if (isBusiness) {
                        "Устройство исчезнет из корпоративного списка, но заявки, чеки и гарантия останутся."
                    } else {
                        "Связь с карточкой будет удалена, но история заявок, чеки и гарантия останутся."
                    },
                )
            },
            confirmButton = {
                TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("Удалить") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Отмена") } },
        )
    }
    warrantyClaimOrder?.let { order ->
        AlertDialog(
            onDismissRequest = { warrantyClaimOrder = null; warrantyClaimProblem = "" },
            title = { Text("Обращение по гарантии") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Талон ${order.warrantyNumber} · исходный ремонт ${order.serviceNumber}")
                    OutlinedTextField(
                        value = warrantyClaimProblem,
                        onValueChange = { warrantyClaimProblem = it.take(1800) },
                        label = { Text("Что снова неисправно?") },
                        minLines = 3,
                        shape = RoundedCornerShape(14.dp),
                    )
                    Text(
                        "Сервис проверит связь неисправности с ремонтом. Если случай не подпадает под гарантию, администратор подтвердит смету до начала платных работ.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                }
            },
            confirmButton = {
                TextButton(
                    enabled = warrantyClaimProblem.trim().length >= 5 && !busy,
                    onClick = {
                        val selected = warrantyClaimOrder ?: return@TextButton
                        onWarrantyClaim(selected.id, warrantyClaimProblem.trim())
                        warrantyClaimOrder = null
                        warrantyClaimProblem = ""
                    },
                ) { Text(if (busy) "Отправляем…" else "Отправить") }
            },
            dismissButton = {
                TextButton(onClick = { warrantyClaimOrder = null; warrantyClaimProblem = "" }) {
                    Text("Отмена")
                }
            },
        )
    }
    Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(device.deviceType.deviceLabel(), fontSize = 12.sp, color = UtpBlue)
            Text(
                device.nickname ?: listOfNotNull(device.brand, device.model).joinToString(" ").ifBlank { "Устройство" },
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = UtpInk,
            )
            if (device.serialNumber != null) Text("Серийный № ${device.serialNumber}", fontSize = 12.sp, color = UtpMuted)
            val isDue = date.isNotBlank() && runCatching { LocalDate.parse(date) <= LocalDate.now(ZoneId.of("Europe/Moscow")) }.getOrDefault(false)
            Text(
                when {
                    date.isBlank() -> "Напоминание не задано"
                    isDue -> "Пора обслужить · $date"
                    else -> "Напоминание · $date"
                },
                fontWeight = FontWeight.SemiBold,
                color = if (isDue) UtpBlue else UtpInk,
            )
            MaintenanceDatePicker(date) { date = it }
            DeviceTextField(note, { note = it.take(250) }, "Примечание к напоминанию")
            OutlinedButton(
                enabled = !busy,
                onClick = { onSaveReminder(date.ifBlank { null }, note.trim()) },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(13.dp),
            ) { Text("Сохранить напоминание") }
            if (device.deviceType in deviceTypes) {
                Button(onClick = onRepeat, enabled = !busy, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(13.dp)) {
                    Text(if (isBusiness) "Новая заявка компании" else "Повторить заявку")
                }
            }
            Text("История ремонта", fontWeight = FontWeight.SemiBold, color = UtpInk)
            if (device.repairOrders.isEmpty()) {
                Text("Заявок пока нет.", fontSize = 12.sp, color = UtpMuted)
            } else {
                device.repairOrders.forEach { order ->
                    Column(Modifier.fillMaxWidth().padding(vertical = 3.dp)) {
                        Text("${order.serviceNumber} · ${order.status.repairStatusLabel()}", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        Text(order.problem, fontSize = 12.sp, color = UtpMuted)
                        order.receiptNumber?.let { Text("Чек $it", fontSize = 11.sp, color = UtpMuted) }
                        order.warrantyNumber?.let { Text("Гарантия $it · до ${order.warrantyExpiresAt?.take(10)}", fontSize = 11.sp, color = UtpMuted) }
                        order.warrantyOriginOrderServiceNumber?.let {
                            Text("Гарантийное обращение по ремонту $it", fontSize = 11.sp, color = UtpBlue)
                        }
                        val warrantyActive = order.warrantyExpiresAt?.let { expiry ->
                            runCatching { Instant.parse(expiry).isAfter(Instant.now()) }.getOrDefault(false)
                        } == true
                        if (warrantyActive && order.warrantyNumber != null && order.warrantyOriginOrderServiceNumber == null) {
                            TextButton(
                                enabled = !busy,
                                onClick = { warrantyClaimOrder = order },
                            ) { Text("Обратиться по гарантии") }
                        }
                    }
                }
            }
            TextButton(onClick = { confirmDelete = true }, enabled = !busy) { Text("Удалить из списка") }
        }
    }
}

@Composable
private fun MaintenanceDatePicker(value: String, onDateChanged: (String) -> Unit) {
    val context = androidx.compose.ui.platform.LocalContext.current
    OutlinedButton(
        onClick = {
            val current = runCatching { LocalDate.parse(value) }.getOrElse { LocalDate.now() }
            DatePickerDialog(
                context,
                { _, year, month, day -> onDateChanged("%04d-%02d-%02d".format(year, month + 1, day)) },
                current.year,
                current.monthValue - 1,
                current.dayOfMonth,
            ).show()
        },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
    ) { Text(if (value.isBlank()) "Выбрать дату" else "Дата обслуживания: $value", modifier = Modifier.fillMaxWidth()) }
    if (value.isNotBlank()) {
        TextButton(onClick = { onDateChanged("") }) { Text("Убрать дату") }
    }
}

@Composable
private fun DeviceTextField(value: String, onChange: (String) -> Unit, label: String) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        shape = RoundedCornerShape(14.dp),
    )
}

private fun String.repairStatusLabel(): String = when (this) {
    "REQUESTED" -> "Принята"
    "ASSIGNED" -> "Мастер назначен"
    "IN_PROGRESS" -> "В работе"
    "READY_FOR_PICKUP" -> "Готова к выдаче"
    "COMPLETED" -> "Завершена"
    "CANCELLED" -> "Отменена"
    else -> this
}
