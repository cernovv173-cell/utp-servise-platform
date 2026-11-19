package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.AdminCustomer
import ru.utp.servise.data.AdminCustomerPage
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.NewAdminCustomerResult
import ru.utp.servise.data.OrderAddress
import ru.utp.servise.data.RepairOrder

private val orderDevices = listOf(
    "COMPUTER" to "Компьютер",
    "LAPTOP" to "Ноутбук",
    "MONOBLOCK" to "Моноблок",
)

private data class AdminOrderSubmission(
    val orderCreated: Boolean,
    val newCustomer: NewAdminCustomerResult? = null,
    val failureMessage: String? = null,
)

@Composable
fun AdminOrderCreationScreen(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onBack: () -> Unit,
    onCreated: () -> Unit,
) {
    var searchText by remember { mutableStateOf("") }
    var appliedSearch by remember { mutableStateOf("") }
    var loadRevision by remember { mutableStateOf(0) }
    var customers by remember { mutableStateOf<List<AdminCustomer>>(emptyList()) }
    var selectedCustomer by remember { mutableStateOf<AdminCustomer?>(null) }
    var createNewCustomer by remember { mutableStateOf(false) }
    var newCustomerName by remember { mutableStateOf("") }
    var newCustomerEmail by remember { mutableStateOf("") }
    var oneTimeCredentials by remember { mutableStateOf<NewAdminCustomerResult?>(null) }
    var credentialsForCompletedOrder by remember { mutableStateOf(false) }
    var credentialOrderError by remember { mutableStateOf<String?>(null) }
    var deviceType by remember { mutableStateOf(orderDevices.first().first) }
    var deviceMenu by remember { mutableStateOf(false) }
    var repairLocation by remember { mutableStateOf("CUSTOMER_ADDRESS") }
    var visitIsWithinCity by remember { mutableStateOf(true) }
    var visitDistanceKm by remember { mutableStateOf("") }
    var problem by remember { mutableStateOf("") }
    var phone by remember { mutableStateOf("") }
    var city by remember { mutableStateOf("") }
    var street by remember { mutableStateOf("") }
    var house by remember { mutableStateOf("") }
    var apartment by remember { mutableStateOf("") }
    var additionalInfo by remember { mutableStateOf("") }

    LaunchedEffect(appliedSearch, loadRevision) {
        runAction({ ApiClient.administratorCustomers(token, appliedSearch, 1, 20) }) { result ->
            (result as? AdminCustomerPage)?.let { customers = it.customers.filter(AdminCustomer::active) }
        }
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        TextButton(onClick = onBack) { Text("←  Управление заявками") }
        Text("Новая заявка", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Оформите заказ от имени сервиса для существующего или нового клиента.", fontSize = 12.sp, color = UtpMuted)

        Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
            Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Клиент", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(
                        selected = !createNewCustomer,
                        onClick = { createNewCustomer = false; selectedCustomer = null },
                        label = { Text("Из базы") },
                    )
                    FilterChip(
                        selected = createNewCustomer,
                        onClick = { createNewCustomer = true; selectedCustomer = null },
                        label = { Text("Новый клиент") },
                    )
                }
                if (createNewCustomer) {
                    Text(
                        "Создадим логин и временный пароль. Передайте их клиенту; при первом входе он сменит пароль и при желании сам подключит MAX в профиле.",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                    OutlinedTextField(
                        value = newCustomerName,
                        onValueChange = { newCustomerName = it.take(120) },
                        label = { Text("Имя клиента") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                    )
                    OutlinedTextField(
                        value = newCustomerEmail,
                        onValueChange = { newCustomerEmail = it.take(320) },
                        label = { Text("Электронная почта (необязательно)") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        shape = RoundedCornerShape(12.dp),
                    )
                } else selectedCustomer?.let { customer ->
                    Text(customer.displayName, fontWeight = FontWeight.Medium, color = UtpInk)
                    Text(
                        "${customer.email ?: "вход через МАКС"} · ${customer.phoneNumber ?: "телефон не указан"}",
                        fontSize = 12.sp,
                        color = UtpMuted,
                    )
                    TextButton(onClick = { selectedCustomer = null }) { Text("Выбрать другого") }
                } ?: run {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        OutlinedTextField(
                            value = searchText,
                            onValueChange = { searchText = it.take(120) },
                            label = { Text("Имя, почта или телефон") },
                            modifier = Modifier.weight(1f),
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                        )
                        Button(onClick = { appliedSearch = searchText.trim(); loadRevision += 1 }, shape = RoundedCornerShape(12.dp)) {
                            Text("Найти")
                        }
                    }
                    customers.forEach { customer ->
                        OutlinedButton(
                            onClick = {
                                selectedCustomer = customer
                                phone = customer.phoneNumber.orEmpty()
                            },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(12.dp),
                        ) {
                            Column(Modifier.fillMaxWidth()) {
                                Text(customer.displayName, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${customer.email ?: "вход через МАКС"} · ${customer.phoneNumber ?: "без телефона"}",
                                    fontSize = 11.sp,
                                )
                            }
                        }
                    }
                    if (customers.isEmpty()) Text("Клиенты не найдены. Уточните запрос и нажмите «Найти».", fontSize = 12.sp, color = UtpMuted)
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

        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { deviceMenu = true }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                Text(orderDevices.first { it.first == deviceType }.second)
            }
            DropdownMenu(expanded = deviceMenu, onDismissRequest = { deviceMenu = false }) {
                orderDevices.forEach { (value, label) ->
                    DropdownMenuItem(text = { Text(label) }, onClick = { deviceType = value; deviceMenu = false })
                }
            }
        }
        OutlinedTextField(
            value = problem,
            onValueChange = { problem = it.take(2000) },
            label = { Text("Опишите неисправность") },
            modifier = Modifier.fillMaxWidth().height(130.dp),
            shape = RoundedCornerShape(14.dp),
        )
        AdminOrderField(phone, { phone = it.take(32) }, "Телефон для связи${if (createNewCustomer) " клиента" else ""}", KeyboardType.Phone)
        Text(
            if (repairLocation == "CUSTOMER_ADDRESS") "Адрес для выезда" else "Контактный адрес клиента (необязательно)",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = UtpInk,
        )
        AdminOrderField(city, { city = it.take(120) }, if (repairLocation == "CUSTOMER_ADDRESS") "Город для выезда" else "Город")
        AdminOrderField(street, { street = it.take(180) }, if (repairLocation == "CUSTOMER_ADDRESS") "Улица для выезда" else "Улица")
        AdminOrderField(house, { house = it.take(30) }, if (repairLocation == "CUSTOMER_ADDRESS") "Дом для выезда" else "Дом")
        AdminOrderField(apartment, { apartment = it.take(30) }, "Квартира")
        OutlinedTextField(
            value = additionalInfo,
            onValueChange = { additionalInfo = it.take(500) },
            label = { Text("Дополнительная информация") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
        )
        Button(
            onClick = {
                runAction({
                    var newCustomer: NewAdminCustomerResult? = null
                    val customer = if (createNewCustomer) {
                        ApiClient.createAdministratorCustomer(
                            token,
                            newCustomerName.trim(),
                            newCustomerEmail.trim(),
                            phone.trim(),
                        ).also { created ->
                            newCustomer = created
                        }.customer
                    } else {
                        selectedCustomer ?: error("Выберите клиента из базы.")
                    }
                    try {
                        ApiClient.createAdministratorOrder(
                            token,
                            customer.id,
                            deviceType,
                            problem.trim(),
                            repairLocation,
                            OrderAddress(
                                contactPhone = phone.trim(),
                                city = city.trim(),
                                street = street.trim(),
                                house = house.trim(),
                                apartment = apartment.trim(),
                                additionalInfo = additionalInfo.trim(),
                            ),
                            visitIsWithinCity = visitIsWithinCity,
                            visitCustomerDistanceKm = visitDistanceKm.toIntOrNull(),
                        )
                        AdminOrderSubmission(
                            orderCreated = true,
                            newCustomer = newCustomer,
                        )
                    } catch (failure: Exception) {
                        if (newCustomer == null) throw failure
                        AdminOrderSubmission(
                            orderCreated = false,
                            newCustomer = newCustomer,
                            failureMessage = failure.message ?: "Не удалось создать заявку.",
                        )
                    }
                }) { result ->
                    val submission = result as? AdminOrderSubmission ?: return@runAction
                    if (submission.newCustomer != null) {
                        oneTimeCredentials = submission.newCustomer
                        credentialsForCompletedOrder = submission.orderCreated
                        credentialOrderError = submission.failureMessage
                        selectedCustomer = submission.newCustomer.customer
                        createNewCustomer = false
                    } else if (submission.orderCreated) {
                        onCreated()
                    }
                }
            },
            enabled = !busy && (if (createNewCustomer) {
                newCustomerName.trim().length >= 2 &&
                    (newCustomerEmail.isBlank() || newCustomerEmail.contains('@'))
            } else selectedCustomer != null) && problem.trim().length >= 5 &&
                phone.count(Char::isDigit) >= 7 &&
                (repairLocation != "CUSTOMER_ADDRESS" ||
                    (city.trim().length >= 2 &&
                        street.trim().length >= 2 &&
                        house.trim().isNotEmpty() &&
                        (visitIsWithinCity || (visitDistanceKm.toIntOrNull() ?: 0) > 0))),
            modifier = Modifier.fillMaxWidth().height(52.dp),
            shape = RoundedCornerShape(14.dp),
        ) { Text(if (busy) "Создаём…" else "Создать заявку") }
        Spacer(Modifier.height(12.dp))
    }

    oneTimeCredentials?.let { credentials ->
        AlertDialog(
            onDismissRequest = {
                oneTimeCredentials = null
                if (credentialsForCompletedOrder) onCreated()
            },
            title = { Text("Данные для первого входа") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    SelectionContainer {
                        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(
                                "Логин: ${credentials.customer.login ?: credentials.customer.email ?: "—"}",
                                fontWeight = FontWeight.SemiBold,
                            )
                            Text(
                                "Временный пароль: ${credentials.temporaryPassword.orEmpty()}",
                                fontWeight = FontWeight.SemiBold,
                            )
                        }
                    }
                    Text("Передайте данные клиенту безопасно. При первом входе он сменит пароль; MAX можно подключить самостоятельно в профиле.")
                    credentialOrderError?.let {
                        Text("Аккаунт создан, но заявка не создана. Клиент сохранён в базе; можно повторить заявку, выбрав его.", color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    oneTimeCredentials = null
                    if (credentialsForCompletedOrder) onCreated()
                }) { Text("Я сохранил данные") }
            },
        )
    }
}

@Composable
private fun AdminOrderField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    keyboardType: KeyboardType = KeyboardType.Text,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = keyboardType),
        shape = RoundedCornerShape(14.dp),
    )
}
