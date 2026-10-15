package ru.utp.servise.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import ru.utp.servise.data.OrderAddress
import ru.utp.servise.data.CustomerDevice
import ru.utp.servise.data.CustomerServicePrice
import ru.utp.servise.data.RepairRequestDetails
import ru.utp.servise.data.deviceLabel
import java.time.Instant
import java.time.LocalDateTime
import java.time.ZoneId
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter
import java.util.Locale

private val deviceTypes = listOf("COMPUTER", "LAPTOP", "PHONE", "TABLET")
private val symptomOptions = mapOf(
    "COMPUTER" to listOf("Не включается" to "Не включается.", "Перегревается" to "Сильно шумит или перегревается.", "Нет изображения" to "Нет изображения на экране.", "Медленно работает" to "Работает медленно или зависает."),
    "LAPTOP" to listOf("Не включается" to "Не включается.", "Не заряжается" to "Не заряжается или быстро разряжается.", "Проблема с экраном" to "Есть проблема с изображением на экране.", "Греется" to "Сильно греется или шумит."),
    "PHONE" to listOf("Не включается" to "Не включается.", "Не заряжается" to "Не заряжается или быстро разряжается.", "Проблема с экраном" to "Повреждён экран или нет изображения.", "Проблема со звуком" to "Не работает микрофон, динамик или звук искажён."),
    "TABLET" to listOf("Не включается" to "Не включается.", "Не заряжается" to "Не заряжается или быстро разряжается.", "Проблема с экраном" to "Повреждён экран или нет изображения.", "Медленно работает" to "Работает медленно или зависает."),
)

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun RepairRequestForm(
    initialPhone: String,
    onBack: () -> Unit,
    onSubmit: (String, String, OrderAddress, RepairRequestDetails, Uri?) -> Unit,
    busy: Boolean,
    banners: List<ru.utp.servise.data.SiteBanner> = emptyList(),
    token: String = "",
    onCampaignNavigate: (String) -> Unit = {},
    customerDevices: List<CustomerDevice> = emptyList(),
    initialDeviceId: String? = null,
    servicePrices: List<CustomerServicePrice> = emptyList(),
) {
    var device by remember { mutableStateOf(deviceTypes.first()) }
    var deviceMenu by remember { mutableStateOf(false) }
    var selectedCustomerDeviceId by remember { mutableStateOf(initialDeviceId) }
    var problem by remember { mutableStateOf("") }
    var phone by remember(initialPhone) { mutableStateOf(initialPhone) }
    var city by remember { mutableStateOf("Пушкино") }
    var street by remember { mutableStateOf("") }
    var house by remember { mutableStateOf("") }
    var apartment by remember { mutableStateOf("") }
    var entrance by remember { mutableStateOf("") }
    var hasBarrier by remember { mutableStateOf(false) }
    var floor by remember { mutableStateOf("") }
    var additionalPhone by remember { mutableStateOf("") }
    var additionalInfo by remember { mutableStateOf("") }
    var deviceBrand by remember { mutableStateOf("") }
    var deviceModel by remember { mutableStateOf("") }
    var deviceSerialNumber by remember { mutableStateOf("") }
    var selectedPhoto by remember { mutableStateOf<Uri?>(null) }
    var showSymptomGuide by remember { mutableStateOf(false) }
    var showValidation by remember { mutableStateOf(false) }
    var preferredDateMillis by remember { mutableStateOf<Long?>(null) }
    var preferredTime by remember { mutableStateOf<Pair<Int, Int>?>(null) }
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }
    val datePickerState = rememberDatePickerState()
    val timePickerState = rememberTimePickerState(initialHour = 10, initialMinute = 0, is24Hour = true)
    val selectedCustomerDevice = customerDevices.firstOrNull { it.id == selectedCustomerDeviceId }
    LaunchedEffect(initialDeviceId, customerDevices) {
        val saved = customerDevices.firstOrNull { it.id == initialDeviceId }
        if (saved != null) {
            selectedCustomerDeviceId = saved.id
            device = saved.deviceType
            deviceBrand = saved.brand.orEmpty()
            deviceModel = saved.model.orEmpty()
            deviceSerialNumber = saved.serialNumber.orEmpty()
        }
    }
    val preferredAt = preferredDateMillis?.let { millis ->
        val date = Instant.ofEpochMilli(millis).atZone(ZoneOffset.UTC).toLocalDate()
        val time = preferredTime ?: (10 to 0)
        LocalDateTime.of(date, java.time.LocalTime.of(time.first, time.second))
            .atZone(ZoneId.systemDefault())
            .toInstant()
            .toString()
    }
    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    preferredDateMillis = datePickerState.selectedDateMillis
                    showDatePicker = false
                    showTimePicker = true
                }) { Text("Далее") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Отмена") }
            },
        ) {
            DatePicker(state = datePickerState, showModeToggle = false)
        }
    }
    if (showTimePicker) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Выберите время") },
            text = { TimePicker(state = timePickerState) },
            confirmButton = {
                TextButton(onClick = {
                    preferredTime = timePickerState.hour to timePickerState.minute
                    showTimePicker = false
                }) { Text("Готово") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Отмена") }
            },
        )
    }
    Column(Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(20.dp)) {
        TextButton(onClick = onBack) { Text("←  Назад") }
        Text("Новая заявка", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            "Укажите данные техники и желаемое время. Сервис подтвердит его после проверки расписания.",
            fontSize = 13.sp,
            color = UtpMuted,
            modifier = Modifier.padding(top = 5.dp, bottom = 16.dp),
        )
        CampaignBannerCarousel(
            banners = banners,
            placement = "SERVICE",
            token = token,
            onNavigate = onCampaignNavigate,
            requireImage = true,
        )
        if (customerDevices.isNotEmpty()) {
            var savedDeviceMenu by remember { mutableStateOf(false) }
            Box {
                OutlinedButton(onClick = { savedDeviceMenu = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                    Text(
                        selectedCustomerDevice?.let { saved -> "Моя техника: ${saved.nickname ?: listOfNotNull(saved.brand, saved.model).joinToString(" ").ifBlank { saved.deviceType.deviceLabel() }}" }
                            ?: "Выбрать сохранённую технику",
                        modifier = Modifier.weight(1f),
                    )
                    Text("⌄")
                }
                DropdownMenu(expanded = savedDeviceMenu, onDismissRequest = { savedDeviceMenu = false }) {
                    DropdownMenuItem(
                        text = { Text("Новая техника") },
                        onClick = {
                            selectedCustomerDeviceId = null
                            deviceBrand = ""
                            deviceModel = ""
                            deviceSerialNumber = ""
                            savedDeviceMenu = false
                        },
                    )
                    customerDevices.forEach { saved ->
                        DropdownMenuItem(
                            text = { Text(saved.nickname ?: listOfNotNull(saved.brand, saved.model).joinToString(" ").ifBlank { saved.deviceType.deviceLabel() }) },
                            onClick = {
                                selectedCustomerDeviceId = saved.id
                                device = saved.deviceType
                                deviceBrand = saved.brand.orEmpty()
                                deviceModel = saved.model.orEmpty()
                                deviceSerialNumber = saved.serialNumber.orEmpty()
                                savedDeviceMenu = false
                            },
                        )
                    }
                }
            }
            if (selectedCustomerDevice != null) {
                Text(
                    "Заявка будет связана с карточкой техники и появится в её истории.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
        Box {
            OutlinedButton(onClick = { deviceMenu = true }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
                Text("Устройство: ${device.deviceLabel()}", modifier = Modifier.weight(1f))
                Text("⌄")
            }
            DropdownMenu(expanded = deviceMenu, onDismissRequest = { deviceMenu = false }) {
                deviceTypes.forEach { item -> DropdownMenuItem(text = { Text(item.deviceLabel()) }, onClick = { device = item; deviceMenu = false }) }
            }
        }
        Spacer(Modifier.height(10.dp))
        AddressField(deviceBrand, { deviceBrand = it.take(120) }, "Марка техники")
        AddressField(deviceModel, { deviceModel = it.take(160) }, "Модель")
        AddressField(deviceSerialNumber, { deviceSerialNumber = it.take(160) }, "Серийный номер (если известен)")
        Spacer(Modifier.height(12.dp))
        OutlinedTextField(problem, { problem = it.take(2000) }, label = { Text("Опишите неисправность") }, placeholder = { Text("Например: ноутбук не включается") }, modifier = Modifier.fillMaxWidth().height(128.dp), shape = RoundedCornerShape(14.dp))
        TextButton(onClick = { showSymptomGuide = !showSymptomGuide }) {
            Text(if (showSymptomGuide) "Скрыть подсказки" else "Подсказать, как описать неисправность")
        }
        if (showSymptomGuide) {
            Card(shape = RoundedCornerShape(14.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Column(Modifier.fillMaxWidth().padding(12.dp)) {
                    Text("Выберите похожий симптом — мы добавим его в описание. Не разбирайте устройство и не проверяйте его под напряжением.", fontSize = 12.sp, color = UtpMuted, lineHeight = 17.sp)
                    Row(Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 8.dp)) {
                        symptomOptions[device].orEmpty().forEach { (label, summary) ->
                            AssistChip(
                                onClick = { problem = listOf(problem.trim(), summary).filter(String::isNotBlank).joinToString("\n").take(2000) },
                                label = { Text(label, maxLines = 1) },
                                modifier = Modifier.padding(end = 6.dp),
                            )
                        }
                    }
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        AddressField(phone, { phone = it.take(32) }, "Телефон для связи *", KeyboardType.Phone)
        AddressField(city, { city = it.take(120) }, "Город *")
        AddressField(street, { street = it.take(180) }, "Улица *")
        AddressField(house, { house = it.take(30) }, "Дом *")
        AddressField(apartment, { apartment = it.take(30) }, "Квартира")
        AddressField(entrance, { entrance = it.take(30) }, "Подъезд")
        AddressField(floor, { floor = it.take(20) }, "Этаж")
        AddressField(additionalPhone, { additionalPhone = it.take(32) }, "Дополнительный телефон", KeyboardType.Phone)
        OutlinedButton(
            onClick = { showDatePicker = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        ) {
            val chosenDate = preferredDateMillis?.let {
                Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()
                    .format(DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.forLanguageTag("ru-RU")))
            }
            val chosenTime = preferredTime?.let { (hour, minute) -> "%02d:%02d".format(hour, minute) }
            Text(
                if (chosenDate != null && chosenTime != null) "Удобное время: $chosenDate, $chosenTime"
                else "Выбрать удобное время для выезда",
                modifier = Modifier.weight(1f),
            )
        }
        if (preferredDateMillis != null) {
            TextButton(
                onClick = {
                    preferredDateMillis = null
                    preferredTime = null
                },
                modifier = Modifier.align(Alignment.End),
            ) { Text("Сбросить время") }
        }
        Text(
            "Время предварительное — сервис подтвердит его после проверки расписания.",
            fontSize = 12.sp,
            color = UtpMuted,
            modifier = Modifier.padding(bottom = 8.dp),
        )
        PhotoPickerButton(
            label = if (selectedPhoto == null) "Добавить фото техники" else "Фото выбрано · изменить",
        ) { selectedPhoto = it }
        Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            Text("Есть шлагбаум", Modifier.weight(1f), color = UtpInk)
            Switch(checked = hasBarrier, onCheckedChange = { hasBarrier = it })
            Text(if (hasBarrier) "Да" else "Нет", modifier = Modifier.padding(start = 8.dp), color = UtpMuted)
        }
        AddressField(additionalInfo, { additionalInfo = it.take(500) }, "Дополнительная информация")
        ServicePriceGuide(prices = servicePrices, deviceType = selectedCustomerDevice?.deviceType ?: device)
        Spacer(Modifier.height(18.dp))
        val missingFields = buildList {
            if (problem.trim().length < 5) add("опишите неисправность (не менее 5 символов)")
            if (phone.count(Char::isDigit) < 7) add("укажите телефон для связи")
            if (city.trim().length < 2) add("укажите город")
            if (street.trim().length < 2) add("укажите улицу")
            if (house.isBlank()) add("укажите дом")
        }
        if (showValidation && missingFields.isNotEmpty()) {
            Text(
                "Чтобы отправить заявку, ${missingFields.joinToString(", ")}",
                color = androidx.compose.material3.MaterialTheme.colorScheme.error,
                fontSize = 13.sp,
                modifier = Modifier.padding(bottom = 8.dp),
            )
        }
        Button(
            onClick = {
                if (missingFields.isNotEmpty()) {
                    showValidation = true
                    return@Button
                }
                showValidation = false
                onSubmit(
                    device,
                    problem.trim(),
                    OrderAddress(phone.trim(), city.trim(), street.trim(), house.trim(), apartment.trim(), entrance.trim(), hasBarrier, floor.trim(), additionalPhone.trim(), additionalInfo.trim()),
                    RepairRequestDetails(
                        deviceBrand = deviceBrand.trim(),
                        deviceModel = deviceModel.trim(),
                        deviceSerialNumber = deviceSerialNumber.trim(),
                        preferredAt = preferredAt,
                        customerDeviceId = selectedCustomerDeviceId,
                    ),
                    selectedPhoto,
                )
            },
            modifier = Modifier.fillMaxWidth().height(52.dp),
            enabled = !busy,
            shape = RoundedCornerShape(15.dp),
        ) { Text(if (busy) "Отправка…" else "Отправить заявку") }
    }
}

@Composable
private fun AddressField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth().padding(bottom = 9.dp),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(14.dp),
    )
}
