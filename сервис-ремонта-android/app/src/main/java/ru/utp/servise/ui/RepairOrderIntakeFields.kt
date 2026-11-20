package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
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
import ru.utp.servise.data.deviceLabel
import java.time.Instant
import java.time.LocalDateTime
import java.time.LocalTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

val repairOrderDeviceTypes = listOf("COMPUTER", "LAPTOP", "MONOBLOCK")

@Composable
fun RepairOrderDeviceFields(
    deviceType: String,
    onDeviceTypeChange: (String) -> Unit,
    deviceBrand: String,
    onDeviceBrandChange: (String) -> Unit,
    deviceModel: String,
    onDeviceModelChange: (String) -> Unit,
    deviceSerialNumber: String,
    onDeviceSerialNumberChange: (String) -> Unit,
    problem: String,
    onProblemChange: (String) -> Unit,
    showDeviceDetails: Boolean = true,
) {
    var deviceMenu by remember { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        androidx.compose.foundation.layout.Box {
            OutlinedButton(
                onClick = { deviceMenu = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text("Устройство: ${deviceType.deviceLabel()}", modifier = Modifier.weight(1f))
                Text("⌄")
            }
            DropdownMenu(expanded = deviceMenu, onDismissRequest = { deviceMenu = false }) {
                repairOrderDeviceTypes.forEach { value ->
                    DropdownMenuItem(
                        text = { Text(value.deviceLabel()) },
                        onClick = {
                            onDeviceTypeChange(value)
                            deviceMenu = false
                        },
                    )
                }
            }
        }
        if (showDeviceDetails) {
            RepairOrderTextField(deviceBrand, onDeviceBrandChange, "Марка техники", maxLength = 120)
            RepairOrderTextField(deviceModel, onDeviceModelChange, "Модель", maxLength = 160)
            RepairOrderTextField(
                deviceSerialNumber,
                onDeviceSerialNumberChange,
                "Серийный номер (если известен)",
                maxLength = 160,
            )
        }
        OutlinedTextField(
            value = problem,
            onValueChange = { onProblemChange(it.take(2000)) },
            label = { Text("Опишите неисправность") },
            placeholder = { Text("Например: ноутбук не включается") },
            modifier = Modifier.fillMaxWidth().height(128.dp),
            shape = RoundedCornerShape(14.dp),
        )
    }
}

@Composable
fun RepairOrderContactFields(
    phone: String,
    onPhoneChange: (String) -> Unit,
    city: String,
    onCityChange: (String) -> Unit,
    street: String,
    onStreetChange: (String) -> Unit,
    house: String,
    onHouseChange: (String) -> Unit,
    apartment: String,
    onApartmentChange: (String) -> Unit,
    entrance: String,
    onEntranceChange: (String) -> Unit,
    hasBarrier: Boolean,
    onHasBarrierChange: (Boolean) -> Unit,
    floor: String,
    onFloorChange: (String) -> Unit,
    additionalPhone: String,
    onAdditionalPhoneChange: (String) -> Unit,
    additionalInfo: String,
    onAdditionalInfoChange: (String) -> Unit,
    preferredAt: String?,
    onPreferredAtChange: (String?) -> Unit,
    repairLocation: String,
    phoneRequired: Boolean = true,
) {
    val isVisit = repairLocation == "CUSTOMER_ADDRESS"
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        RepairOrderTextField(
            phone,
            onPhoneChange,
            if (phoneRequired) "Телефон для связи *" else "Телефон для связи",
            keyboardType = KeyboardType.Phone,
            maxLength = 32,
        )
        Text(
            if (isVisit) "Адрес для выезда мастера *" else "Адрес клиента (необязательно)",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = UtpInk,
            modifier = Modifier.padding(top = 4.dp),
        )
        RepairOrderTextField(city, onCityChange, if (isVisit) "Город *" else "Город", maxLength = 120)
        RepairOrderTextField(street, onStreetChange, if (isVisit) "Улица *" else "Улица", maxLength = 180)
        RepairOrderTextField(house, onHouseChange, if (isVisit) "Дом *" else "Дом", maxLength = 30)
        RepairOrderTextField(apartment, onApartmentChange, "Квартира", maxLength = 30)
        RepairOrderTextField(entrance, onEntranceChange, "Подъезд", maxLength = 30)
        RepairOrderTextField(floor, onFloorChange, "Этаж", maxLength = 20)
        RepairOrderTextField(
            additionalPhone,
            onAdditionalPhoneChange,
            "Дополнительный телефон",
            KeyboardType.Phone,
            32,
        )
        RepairPreferredTimeField(preferredAt, onPreferredAtChange)
        Row(
            Modifier.fillMaxWidth().padding(vertical = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text("Есть шлагбаум", Modifier.weight(1f), color = UtpInk)
            Switch(checked = hasBarrier, onCheckedChange = onHasBarrierChange)
            Text(if (hasBarrier) "Да" else "Нет", modifier = Modifier.padding(start = 8.dp), color = UtpMuted)
        }
        OutlinedTextField(
            value = additionalInfo,
            onValueChange = { onAdditionalInfoChange(it.take(500)) },
            label = { Text("Дополнительная информация") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        )
    }
}

@Composable
fun RepairOrderTextField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
    maxLength: Int = 500,
) {
    OutlinedTextField(
        value = value,
        onValueChange = { onValueChange(it.take(maxLength)) },
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth().padding(bottom = 6.dp),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(14.dp),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun RepairPreferredTimeField(
    preferredAt: String?,
    onPreferredAtChange: (String?) -> Unit,
) {
    val initialDate = remember(preferredAt) {
        preferredAt?.let { runCatching { Instant.parse(it).toEpochMilli() }.getOrNull() }
    }
    var selectedDateMillis by remember { mutableStateOf(initialDate) }
    var selectedTime by remember {
        mutableStateOf(
            preferredAt?.let { value ->
                runCatching {
                    Instant.parse(value).atZone(ZoneId.systemDefault()).toLocalTime()
                        .let { time -> time.hour to time.minute }
                }.getOrNull()
            },
        )
    }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState(initialSelectedDateMillis = selectedDateMillis)
    val timePickerState = rememberTimePickerState(initialHour = 10, initialMinute = 0, is24Hour = true)

    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    selectedDateMillis = datePickerState.selectedDateMillis
                    showDatePicker = false
                    showTimePicker = selectedDateMillis != null
                }) { Text("Далее") }
            },
            dismissButton = { TextButton(onClick = { showDatePicker = false }) { Text("Отмена") } },
        ) {
            DatePicker(state = datePickerState, showModeToggle = false)
        }
    }
    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Выберите время") },
            text = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    selectedTime = timePickerState.hour to timePickerState.minute
                    val dateMillis = selectedDateMillis
                    if (dateMillis != null) {
                        val date = Instant.ofEpochMilli(dateMillis).atZone(ZoneOffset.UTC).toLocalDate()
                        val time = LocalTime.of(timePickerState.hour, timePickerState.minute)
                        onPreferredAtChange(
                            LocalDateTime.of(date, time).atZone(ZoneId.systemDefault()).toInstant().toString(),
                        )
                    }
                    showTimePicker = false
                }) { Text("Готово") }
            },
            dismissButton = { TextButton(onClick = { showTimePicker = false }) { Text("Отмена") } },
        )
    }

    OutlinedButton(
        onClick = { showDatePicker = true },
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(14.dp),
    ) {
        val chosenDate = selectedDateMillis?.let {
            Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()
                .format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ru-RU")))
        }
        val chosenTime = selectedTime?.let { (hour, minute) -> "%02d:%02d".format(hour, minute) }
        Text(
            if (preferredAt != null && chosenDate != null && chosenTime != null) {
                "Удобное время: $chosenDate, $chosenTime"
            } else "Выбрать удобное время для выезда",
            modifier = Modifier.weight(1f),
        )
    }
    if (preferredAt != null) {
        TextButton(
            onClick = {
                selectedDateMillis = null
                selectedTime = null
                onPreferredAtChange(null)
            },
        ) { Text("Сбросить время") }
    }
    Text(
        "Время предварительное — сервис подтвердит его после проверки расписания.",
        fontSize = 12.sp,
        color = UtpMuted,
        modifier = Modifier.padding(bottom = 8.dp),
    )
    Spacer(Modifier.height(4.dp))
}
