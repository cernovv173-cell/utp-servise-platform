package ru.utp.servise

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
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
import ru.utp.servise.ui.UtpPale
import ru.utp.servise.ui.UtpServiseTheme

private const val diagnosisFeeRub = 850
private const val travelRateRubPerKm = 25

class ScenarioPreviewActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            UtpServiseTheme {
                AndroidScenarioPreviewScreen()
            }
        }
    }
}

@Composable
private fun AndroidScenarioPreviewScreen() {
    var selectedRole by remember { mutableStateOf(0) }
    var isVisit by remember { mutableStateOf(true) }
    var isWithinPushkino by remember { mutableStateOf(false) }
    var serviceAddress by remember { mutableStateOf("") }
    var customerKm by remember { mutableStateOf("18") }
    var verifiedKm by remember { mutableStateOf("") }
    var diagnosisCompleted by remember { mutableStateOf(false) }
    var requestCreated by remember { mutableStateOf(false) }
    var onsiteRepairPossible by remember { mutableStateOf(true) }
    var customerAgreedToPickup by remember { mutableStateOf(false) }
    var repairPrice by remember { mutableStateOf("4500") }
    var paymentMethod by remember { mutableStateOf("Перевод") }
    var onsitePaymentRecorded by remember { mutableStateOf(false) }
    var estimateSubmitted by remember { mutableStateOf(false) }
    var estimateApproved by remember { mutableStateOf<Boolean?>(null) }
    var repairCompleted by remember { mutableStateOf(false) }
    var orderReleased by remember { mutableStateOf(false) }
    var servicePaymentMethod by remember { mutableStateOf("Перевод") }

    val enteredKm = customerKm.toIntOrNull()?.coerceAtLeast(0) ?: 0
    val billableKm = (verifiedKm.ifBlank { customerKm }).toIntOrNull()?.coerceAtLeast(0) ?: 0
    val travelFee = if (isVisit && !isWithinPushkino && diagnosisCompleted) {
        billableKm * travelRateRubPerKm
    } else 0
    val diagnosisFee = if (diagnosisCompleted) diagnosisFeeRub else 0
    val technicianFees = diagnosisFee + travelFee
    val serviceCost = repairPrice.toIntOrNull()?.coerceAtLeast(0) ?: 0
    val roleNames = listOf("Клиент", "Мастер", "Администратор")
    val stage = when {
        orderReleased -> "Выдана администратором"
        onsitePaymentRecorded -> "Оплачено мастеру на выезде"
        repairCompleted -> "Готова к выдаче"
        estimateApproved == true -> "Ремонт согласован"
        estimateApproved == false -> "Клиент отказался от ремонта"
        estimateSubmitted -> "Смета отправлена администратору"
        diagnosisCompleted -> "Диагностика проведена"
        requestCreated -> "Назначена мастеру"
        else -> "Черновик заявки"
    }

    Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(UtpPale)
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
        ) {
            Text("ЕНОТ СЕРВИС · ПРЕДПРОСМОТР", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Spacer(Modifier.height(8.dp))
            Text("Заявка на ремонт", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            PreviewCard {
                Text("ДЕМО-МАКЕТ · НИЧЕГО НЕ СОХРАНЯЕТСЯ", color = MaterialTheme.colorScheme.tertiary, fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(4.dp))
                Text("Все действия остаются на этом экране. Нет запросов к серверу, настоящих заявок и платежей.", style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(12.dp))
            TabRow(selectedTabIndex = selectedRole) {
                roleNames.forEachIndexed { index, name ->
                    Tab(selected = selectedRole == index, onClick = { selectedRole = index }, text = { Text(name) })
                }
            }
            Text("Демо-статус: $stage", modifier = Modifier.padding(vertical = 10.dp), style = MaterialTheme.typography.labelMedium)

            when (selectedRole) {
                0 -> ClientPreview(
                    isVisit = isVisit,
                    onVisitChange = { isVisit = it },
                    address = serviceAddress,
                    onAddressChange = { serviceAddress = it },
                    isWithinPushkino = isWithinPushkino,
                    onWithinPushkinoChange = { isWithinPushkino = it },
                    customerKm = customerKm,
                    onCustomerKmChange = { customerKm = it; verifiedKm = "" },
                    enteredKm = enteredKm,
                    requestCreated = requestCreated,
                    onCreateRequest = { requestCreated = true },
                )
                1 -> TechnicianPreview(
                    isVisit = isVisit,
                    isWithinPushkino = isWithinPushkino,
                    customerKm = customerKm,
                    verifiedKm = verifiedKm,
                    onVerifiedKmChange = { verifiedKm = it },
                    diagnosisCompleted = diagnosisCompleted,
                    onDiagnosisChange = { diagnosisCompleted = it },
                    travelFee = travelFee,
                    technicianFees = technicianFees,
                    onsiteRepairPossible = onsiteRepairPossible,
                    onOnsiteRepairChange = { onsiteRepairPossible = it },
                    customerAgreedToPickup = customerAgreedToPickup,
                    onPickupConsentChange = { customerAgreedToPickup = it },
                    repairPrice = repairPrice,
                    onRepairPriceChange = { repairPrice = it },
                    paymentMethod = paymentMethod,
                    onPaymentMethodChange = { paymentMethod = it },
                    serviceCost = serviceCost,
                    onsitePaymentRecorded = onsitePaymentRecorded,
                    onRecordOnsitePayment = { onsitePaymentRecorded = true },
                    requestCreated = requestCreated,
                    onCreateRequest = { requestCreated = true },
                    estimateSubmitted = estimateSubmitted,
                    onSubmitEstimate = { estimateSubmitted = true },
                )
                else -> AdministratorPreview(
                    isVisit = isVisit,
                    isWithinPushkino = isWithinPushkino,
                    customerKm = customerKm,
                    verifiedKm = verifiedKm,
                    onVerifiedKmChange = { verifiedKm = it },
                    onsiteRepairPossible = onsiteRepairPossible,
                    customerAgreedToPickup = customerAgreedToPickup,
                    onsitePaymentRecorded = onsitePaymentRecorded,
                    diagnosisCompleted = diagnosisCompleted,
                    estimateSubmitted = estimateSubmitted,
                    estimateApproved = estimateApproved,
                    onEstimateDecision = { estimateApproved = it },
                    repairCompleted = repairCompleted,
                    onRepairCompleted = { repairCompleted = true },
                    orderReleased = orderReleased,
                    onOrderReleased = { orderReleased = true },
                    paymentMethod = servicePaymentMethod,
                    onPaymentMethodChange = { servicePaymentMethod = it },
                    technicianFees = technicianFees,
                )
            }

            Spacer(Modifier.height(14.dp))
            PreviewCard {
                Text("ТЕКУЩИЙ РАСЧЁТ", fontWeight = FontWeight.Bold)
                Spacer(Modifier.height(8.dp))
                SummaryRow("Диагностика", if (diagnosisCompleted) "$diagnosisFeeRub ₽" else "0 ₽ · ещё не проведена")
                if (isVisit) {
                    SummaryRow(
                        "Выезд",
                        when {
                            isWithinPushkino -> "Бесплатно · Пушкино"
                            !diagnosisCompleted -> "0 ₽ · пока нет диагностики"
                            else -> "$travelFee ₽ · ${verifiedKm.ifBlank { customerKm }} км в одну сторону"
                        },
                    )
                }
                SummaryRow("Отдельно мастеру", "$technicianFees ₽ · 100%")
                Spacer(Modifier.height(4.dp))
                Text("Диагностика — один раз за заявку. За пределами Пушкино выезд — 25 ₽/км от границы в одну сторону, только если диагностика проведена.", style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

@Composable
private fun ClientPreview(
    isVisit: Boolean,
    onVisitChange: (Boolean) -> Unit,
    address: String,
    onAddressChange: (String) -> Unit,
    isWithinPushkino: Boolean,
    onWithinPushkinoChange: (Boolean) -> Unit,
    customerKm: String,
    onCustomerKmChange: (String) -> Unit,
    enteredKm: Int,
    requestCreated: Boolean,
    onCreateRequest: () -> Unit,
) {
    PreviewCard {
        Text("КАК ПЕРЕДАТЬ ТЕХНИКУ?", fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { onVisitChange(false) }) { Text("В сервис") }
            OutlinedButton(onClick = { onVisitChange(true) }) { Text("Вызвать мастера") }
        }
        if (isVisit) {
            Spacer(Modifier.height(8.dp))
            Text("Пушкино, Московская область", style = MaterialTheme.typography.bodyMedium)
            OutlinedTextField(
                value = address,
                onValueChange = onAddressChange,
                label = { Text("Улица и дом") },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { onWithinPushkinoChange(true) }) { Text("В Пушкино") }
                OutlinedButton(onClick = { onWithinPushkinoChange(false) }) { Text("За городом") }
            }
            if (!isWithinPushkino) {
                OutlinedTextField(
                    value = customerKm,
                    onValueChange = onCustomerKmChange,
                    label = { Text("От границы Пушкино, км в одну сторону") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                Text("Примерно $enteredKm км × 25 ₽ = ${enteredKm * travelRateRubPerKm} ₽, если диагностика будет проведена. Километраж проверят по Яндекс Картам; интеграции нет.", style = MaterialTheme.typography.bodySmall)
            } else {
                Text("Выезд в пределах Пушкино бесплатный.", style = MaterialTheme.typography.bodySmall)
            }
        }
        Spacer(Modifier.height(10.dp))
        Text("Диагностика — 850 ₽, только если мастер её проведёт.", style = MaterialTheme.typography.bodyMedium)
        Spacer(Modifier.height(10.dp))
        Button(onClick = onCreateRequest, modifier = Modifier.fillMaxWidth()) { Text(if (requestCreated) "Демо-заявка готова" else "Создать демо-заявку") }
    }
}

@Composable
private fun TechnicianPreview(
    isVisit: Boolean,
    isWithinPushkino: Boolean,
    customerKm: String,
    verifiedKm: String,
    onVerifiedKmChange: (String) -> Unit,
    diagnosisCompleted: Boolean,
    onDiagnosisChange: (Boolean) -> Unit,
    travelFee: Int,
    technicianFees: Int,
    onsiteRepairPossible: Boolean,
    onOnsiteRepairChange: (Boolean) -> Unit,
    customerAgreedToPickup: Boolean,
    onPickupConsentChange: (Boolean) -> Unit,
    repairPrice: String,
    onRepairPriceChange: (String) -> Unit,
    paymentMethod: String,
    onPaymentMethodChange: (String) -> Unit,
    serviceCost: Int,
    onsitePaymentRecorded: Boolean,
    onRecordOnsitePayment: () -> Unit,
    requestCreated: Boolean,
    onCreateRequest: () -> Unit,
    estimateSubmitted: Boolean,
    onSubmitEstimate: () -> Unit,
) {
    PreviewCard {
        Text("РАБОТА МАСТЕРА", fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text("Заявка DEMO-001 · ${if (isVisit) "выезд к клиенту" else "приём в сервисе"}", style = MaterialTheme.typography.bodySmall)
        if (!requestCreated) {
            Spacer(Modifier.height(8.dp))
            Button(onClick = onCreateRequest) { Text("Подготовить демо-заявку") }
        }
        if (isVisit && !isWithinPushkino) {
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = verifiedKm.ifBlank { customerKm },
                onValueChange = onVerifiedKmChange,
                label = { Text("Проверено по Яндекс Картам, км") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Text("Проверка выполняется вручную. Сервис карты из приложения не вызывается.", style = MaterialTheme.typography.bodySmall)
        }
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            Text("Диагностика проведена", modifier = Modifier.weight(1f))
            Switch(checked = diagnosisCompleted, onCheckedChange = onDiagnosisChange)
        }
        if (diagnosisCompleted) {
            SummaryRow("Диагностика", "$diagnosisFeeRub ₽ · мастеру")
            if (isVisit) SummaryRow("Выезд", "$travelFee ₽ · мастеру")
            SummaryRow("Всего отдельных начислений", "$technicianFees ₽")
        }
        if (isVisit) {
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { onOnsiteRepairChange(true) }) { Text("На месте") }
                OutlinedButton(onClick = { onOnsiteRepairChange(false) }) { Text("В сервис") }
            }
            if (onsiteRepairPossible) {
                Spacer(Modifier.height(8.dp))
                Text("Мастер сам согласует ремонт и цену с клиентом, без администратора.", style = MaterialTheme.typography.bodySmall)
                OutlinedTextField(
                    value = repairPrice,
                    onValueChange = onRepairPriceChange,
                    label = { Text("Цена ремонта, ₽") },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { onPaymentMethodChange("Наличные") }) { Text("Наличные") }
                    OutlinedButton(onClick = { onPaymentMethodChange("Перевод") }) { Text("Перевод") }
                }
                Text("Выбрано: $paymentMethod · к оплате ${serviceCost + technicianFees} ₽", fontWeight = FontWeight.SemiBold)
                Button(onClick = onRecordOnsitePayment, enabled = diagnosisCompleted, modifier = Modifier.fillMaxWidth()) {
                    Text(if (onsitePaymentRecorded) "Демо-оплата отмечена" else "Записать демо-оплату")
                }
            } else {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Switch(checked = customerAgreedToPickup, onCheckedChange = onPickupConsentChange)
                    Text("Клиент согласен на перевозку в сервис")
                }
                Text("Мастер фиксирует состояние и комплектность до передачи техники.", style = MaterialTheme.typography.bodySmall)
            }
        } else {
            if (!diagnosisCompleted) {
                Text("После диагностики мастер передаёт смету администратору.", style = MaterialTheme.typography.bodySmall)
            } else {
                Button(onClick = onSubmitEstimate, modifier = Modifier.fillMaxWidth()) {
                    Text(if (estimateSubmitted) "Смета передана администратору" else "Передать смету администратору")
                }
            }
        }
    }
}

@Composable
private fun AdministratorPreview(
    isVisit: Boolean,
    isWithinPushkino: Boolean,
    customerKm: String,
    verifiedKm: String,
    onVerifiedKmChange: (String) -> Unit,
    onsiteRepairPossible: Boolean,
    customerAgreedToPickup: Boolean,
    onsitePaymentRecorded: Boolean,
    diagnosisCompleted: Boolean,
    estimateSubmitted: Boolean,
    estimateApproved: Boolean?,
    onEstimateDecision: (Boolean) -> Unit,
    repairCompleted: Boolean,
    onRepairCompleted: () -> Unit,
    orderReleased: Boolean,
    onOrderReleased: () -> Unit,
    paymentMethod: String,
    onPaymentMethodChange: (String) -> Unit,
    technicianFees: Int,
) {
    PreviewCard {
        Text("РАБОТА АДМИНИСТРАТОРА", fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(8.dp))
        if (isVisit && !isWithinPushkino) {
            OutlinedTextField(
                value = verifiedKm.ifBlank { customerKm },
                onValueChange = onVerifiedKmChange,
                label = { Text("Проверено по Яндекс Картам, км") },
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
            )
            Text("Километраж сверяется вручную, от границы города в одну сторону.", style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(8.dp))
        }
        if (isVisit && onsiteRepairPossible) {
            Text("Если мастер ремонтирует технику у клиента, администратор не участвует: мастер сам согласует цену, принимает наличные или перевод и отмечает оплату.", style = MaterialTheme.typography.bodyMedium)
            if (onsitePaymentRecorded) SummaryRow("Отдельные начисления мастеру", "$technicianFees ₽")
        } else if (isVisit && !customerAgreedToPickup) {
            Text("Ожидается согласие клиента на перевозку техники в сервис.", style = MaterialTheme.typography.bodyMedium)
        } else {
            Text("В сервисе администратор принимает технику, согласует смету и полностью отвечает за выдачу.", style = MaterialTheme.typography.bodyMedium)
            Spacer(Modifier.height(8.dp))
            if (!diagnosisCompleted) {
                Text("Ожидается отметка мастера о проведённой диагностике.", style = MaterialTheme.typography.bodySmall)
            } else if (!estimateSubmitted) {
                Text("Диагностика завершена. Ожидается смета мастера.", style = MaterialTheme.typography.bodySmall)
            } else if (estimateApproved == null) {
                Text("Смета готова: клиент согласовал ремонт?", style = MaterialTheme.typography.bodyMedium)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { onEstimateDecision(true) }) { Text("Да") }
                    OutlinedButton(onClick = { onEstimateDecision(false) }) { Text("Нет") }
                }
            } else if (estimateApproved == false) {
                Text("Отказ от ремонта. За проведённую диагностику остаётся 850 ₽; выезд без диагностики бесплатный.", style = MaterialTheme.typography.bodySmall)
            } else if (!repairCompleted) {
                Button(onClick = onRepairCompleted, modifier = Modifier.fillMaxWidth()) { Text("Отметить ремонт завершённым") }
            } else if (!orderReleased) {
                Text("Бонусы — максимум 30% услуг; не списываются на диагностику и запчасти.", style = MaterialTheme.typography.bodySmall)
                Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                    listOf("Наличные", "Карта", "Перевод").forEach { method ->
                        OutlinedButton(onClick = { onPaymentMethodChange(method) }) { Text(method) }
                    }
                }
                Button(onClick = onOrderReleased, modifier = Modifier.fillMaxWidth()) { Text("Выдать (только администратор)") }
            } else {
                Text("Заявка выдана администратором. Оплата: $paymentMethod.", style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
}

@Composable
private fun PreviewCard(content: @Composable () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            content()
        }
    }
}

@Composable
private fun SummaryRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodySmall)
        Text(value, style = MaterialTheme.typography.bodySmall, fontWeight = FontWeight.SemiBold)
    }
}
