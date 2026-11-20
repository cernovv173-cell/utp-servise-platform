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
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.OrderAddress
import ru.utp.servise.data.CustomerDevice
import ru.utp.servise.data.CustomerServicePrice
import ru.utp.servise.data.RepairRequestDetails
import ru.utp.servise.data.deviceLabel

private val symptomOptions = mapOf(
    "COMPUTER" to listOf("Не включается" to "Не включается.", "Перегревается" to "Сильно шумит или перегревается.", "Нет изображения" to "Нет изображения на экране.", "Медленно работает" to "Работает медленно или зависает."),
    "LAPTOP" to listOf("Не включается" to "Не включается.", "Не заряжается" to "Не заряжается или быстро разряжается.", "Проблема с экраном" to "Есть проблема с изображением на экране.", "Греется" to "Сильно греется или шумит."),
    "MONOBLOCK" to listOf("Не включается" to "Не включается.", "Нет изображения" to "Нет изображения на экране.", "Перегревается" to "Сильно шумит или перегревается.", "Медленно работает" to "Работает медленно или зависает."),
)

@Composable
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
    var device by remember { mutableStateOf(repairOrderDeviceTypes.first()) }
    var selectedCustomerDeviceId by remember { mutableStateOf(initialDeviceId) }
    var problem by remember { mutableStateOf("") }
    var repairLocation by remember { mutableStateOf("SERVICE_CENTER") }
    var visitIsWithinCity by remember { mutableStateOf(true) }
    var visitDistanceKm by remember { mutableStateOf("") }
    var phone by remember(initialPhone) { mutableStateOf(initialPhone) }
    var city by remember { mutableStateOf("") }
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
    var preferredAt by remember { mutableStateOf<String?>(null) }
    val supportedCustomerDevices = customerDevices.filter { it.deviceType in repairOrderDeviceTypes }
    val selectedCustomerDevice = supportedCustomerDevices.firstOrNull { it.id == selectedCustomerDeviceId }
    LaunchedEffect(initialDeviceId, supportedCustomerDevices) {
        val saved = supportedCustomerDevices.firstOrNull { it.id == initialDeviceId }
        if (saved != null) {
            selectedCustomerDeviceId = saved.id
            device = saved.deviceType
            deviceBrand = saved.brand.orEmpty()
            deviceModel = saved.model.orEmpty()
            deviceSerialNumber = saved.serialNumber.orEmpty()
        } else if (initialDeviceId != null) {
            selectedCustomerDeviceId = null
        }
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
        if (supportedCustomerDevices.isNotEmpty()) {
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
                    supportedCustomerDevices.forEach { saved ->
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
        RepairOrderDeviceFields(
            deviceType = device,
            onDeviceTypeChange = { device = it },
            deviceBrand = deviceBrand,
            onDeviceBrandChange = { deviceBrand = it },
            deviceModel = deviceModel,
            onDeviceModelChange = { deviceModel = it },
            deviceSerialNumber = deviceSerialNumber,
            onDeviceSerialNumberChange = { deviceSerialNumber = it },
            problem = problem,
            onProblemChange = { problem = it },
            showDeviceDetails = selectedCustomerDevice == null,
        )
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
        RepairRequestVisitFields(
            repairLocation = repairLocation,
            onRepairLocationChange = { repairLocation = it },
            isWithinCity = visitIsWithinCity,
            onWithinCityChange = { visitIsWithinCity = it },
            distanceKm = visitDistanceKm,
            onDistanceKmChange = { visitDistanceKm = it },
        )
        RepairOrderContactFields(
            phone = phone,
            onPhoneChange = { phone = it },
            city = city,
            onCityChange = { city = it },
            street = street,
            onStreetChange = { street = it },
            house = house,
            onHouseChange = { house = it },
            apartment = apartment,
            onApartmentChange = { apartment = it },
            entrance = entrance,
            onEntranceChange = { entrance = it },
            hasBarrier = hasBarrier,
            onHasBarrierChange = { hasBarrier = it },
            floor = floor,
            onFloorChange = { floor = it },
            additionalPhone = additionalPhone,
            onAdditionalPhoneChange = { additionalPhone = it },
            additionalInfo = additionalInfo,
            onAdditionalInfoChange = { additionalInfo = it },
            preferredAt = preferredAt,
            onPreferredAtChange = { preferredAt = it },
            repairLocation = repairLocation,
        )
        PhotoPickerButton(
            label = if (selectedPhoto == null) "Добавить фото техники" else "Фото выбрано · изменить",
        ) { selectedPhoto = it }
        ServicePriceGuide(prices = servicePrices, deviceType = selectedCustomerDevice?.deviceType ?: device)
        Spacer(Modifier.height(18.dp))
        val missingFields = buildList {
            if (problem.trim().length < 5) add("опишите неисправность (не менее 5 символов)")
            if (phone.count(Char::isDigit) < 7) add("укажите телефон для связи")
            if (repairLocation == "CUSTOMER_ADDRESS") {
                if (city.trim().length < 2) add("укажите город выезда")
                if (street.trim().length < 2) add("укажите улицу для выезда")
                if (house.isBlank()) add("укажите дом для выезда")
                if (!visitIsWithinCity && (visitDistanceKm.toIntOrNull() ?: 0) < 1) {
                    add("укажите километраж от границы Пушкино")
                }
            }
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
                        repairLocation = repairLocation,
                        visitIsWithinCity = visitIsWithinCity.takeIf { repairLocation == "CUSTOMER_ADDRESS" },
                        visitCustomerDistanceKm =
                            if (repairLocation == "CUSTOMER_ADDRESS" && !visitIsWithinCity) visitDistanceKm.toIntOrNull() else null,
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
