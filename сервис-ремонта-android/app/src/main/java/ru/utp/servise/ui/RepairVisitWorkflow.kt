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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
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
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrder

@Composable
internal fun RepairVisitWorkflow(
    order: RepairOrder,
    role: String,
    currentUserId: String,
    token: String,
    runAction: RunAction,
) {
    if (order.visitScenarioVersion < 1 || role !in listOf("ADMIN", "TECHNICIAN")) return

    val isHomeVisit = order.repairLocation == "CUSTOMER_ADDRESS"
    val wasTransferredToServiceCenter =
        order.repairLocation == "SERVICE_CENTER" && order.visitPickupAgreedAt != null
    val isAssignedTechnician = role == "TECHNICIAN" && order.technicianId == currentUserId
    val canVerify = role == "ADMIN" || isAssignedTechnician
    var isWithinCity by remember(order.id) { mutableStateOf(order.visitIsWithinCity ?: true) }
    var distanceKm by remember(order.id) {
        mutableStateOf((order.visitVerifiedDistanceKm ?: order.visitCustomerDistanceKm)?.toString().orEmpty())
    }
    var repairAgreed by remember(order.id) { mutableStateOf(true) }
    var repairPriceRub by remember(order.id) { mutableStateOf("") }
    var paymentMethod by remember(order.id) { mutableStateOf("CASH") }
    var showPickupConfirmation by remember(order.id) { mutableStateOf(false) }
    var showPaymentConfirmation by remember(order.id) { mutableStateOf(false) }
    var showDiagnosisConfirmation by remember(order.id) { mutableStateOf(false) }
    val canCompleteWork =
        order.status == "IN_PROGRESS" &&
            order.estimates.lastOrNull()?.status != "PENDING" &&
            (!order.workActRequired || order.workAct?.status == "APPROVED")

    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surfaceVariant),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(
                when {
                    isHomeVisit -> "Выезд мастера · Пушкино"
                    wasTransferredToServiceCenter -> "После выезда · сервисный центр"
                    else -> "Ремонт в сервисном центре"
                },
                fontWeight = FontWeight.SemiBold,
                fontSize = 14.sp,
                color = UtpInk,
            )
            if (wasTransferredToServiceCenter) {
                Text(
                    "Согласие на перевозку зафиксировано. После поступления техники заполните акт состояния и комплектности в сервисе, затем продолжайте по обычному порядку: смета, ремонт, проверка и выдача администратором.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
            } else if (!isHomeVisit) {
                Text(
                    "Для ремонта в сервисном центре: приём техники и описание её состояния, согласование сметы, ремонт и выдача администратором.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
            }
            if (isHomeVisit) {
                Text(
                    "Ориентир клиента: ${if (order.visitIsWithinCity == true) "адрес в Пушкино" else "за городом"}" +
                        (order.visitCustomerDistanceKm?.let { ", около $it км от границы" } ?: "") +
                        ". Проверьте по Яндекс Картам до диагностики.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
                if (order.visitDistanceVerifiedAt != null) {
                    Text(
                        "Проверено: ${if (order.visitIsWithinCity == true) "Пушкино, бесплатно" else "${order.visitVerifiedDistanceKm ?: 0} км в одну сторону"}.",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = UtpBlue,
                    )
                }
                if (canVerify && order.diagnosisCompletedAt == null) {
                    listOf(true to "В Пушкино", false to "За городом").forEach { (value, label) ->
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            RadioButton(selected = isWithinCity == value, onClick = { isWithinCity = value })
                            Text(label, fontSize = 12.sp, color = UtpInk)
                        }
                    }
                    if (!isWithinCity) {
                        OutlinedTextField(
                            value = distanceKm,
                            onValueChange = { distanceKm = it.filter(Char::isDigit).take(5) },
                            label = { Text("Проверенное расстояние от границы, км") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                            shape = RoundedCornerShape(12.dp),
                        )
                        distanceKm.toIntOrNull()?.takeIf { it > 0 }?.let { km ->
                            Text("Плата после диагностики: ${km * 25} ₽", fontSize = 12.sp, color = UtpBlue)
                        }
                    }
                    OutlinedButton(
                        onClick = {
                            val distance = if (isWithinCity) 0 else distanceKm.toIntOrNull() ?: 0
                            runAction({
                                ApiClient.verifyRepairVisitDistance(token, order.id, isWithinCity, distance)
                            }) {}
                        },
                        enabled = isWithinCity || (distanceKm.toIntOrNull() ?: 0) > 0,
                        modifier = Modifier.fillMaxWidth(),
                    ) { Text("Сохранить проверку расстояния") }
                }
            }

            Text(
                "Диагностика: ${if (order.diagnosisCompletedAt != null) "${order.diagnosisFeeRub} ₽ начислено" else "850 ₽, если фактически проведена"} · выезд: ${order.visitFeeRub} ₽. Полностью мастеру; бонусами не оплачивается.",
                fontSize = 11.sp,
                color = UtpMuted,
            )

            if (canVerify && order.diagnosisCompletedAt == null &&
                order.status in listOf("ASSIGNED", "IN_PROGRESS")) {
                OutlinedButton(
                    onClick = { showDiagnosisConfirmation = true },
                    enabled = !isHomeVisit || order.visitDistanceVerifiedAt != null,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        if (isHomeVisit && order.visitDistanceVerifiedAt == null)
                            "Сначала проверьте километраж"
                        else "Зафиксировать проведённую диагностику · 850 ₽",
                    )
                }
            }

            if (isHomeVisit && isAssignedTechnician && order.visitPickupAgreedAt == null &&
                order.status in listOf("ASSIGNED", "IN_PROGRESS")) {
                Text(
                    "Если на месте починить нельзя, подтвердите согласие клиента на перевозку. Акт состояния и комплектности заполняется уже в сервисном центре после поступления техники.",
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
                OutlinedButton(
                    onClick = { showPickupConfirmation = true },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("Забрать в сервис") }
            }

            if (isHomeVisit && isAssignedTechnician && order.visitPickupAgreedAt == null &&
                order.status in listOf("ASSIGNED", "IN_PROGRESS")) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = repairAgreed, onClick = { repairAgreed = true })
                    Text("Клиент согласился на ремонт", fontSize = 11.sp, color = UtpInk)
                }
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = !repairAgreed, onClick = { repairAgreed = false })
                    Text("Клиент отказался от ремонта", fontSize = 11.sp, color = UtpInk)
                }
                if (repairAgreed) {
                    OutlinedTextField(
                        value = repairPriceRub,
                        onValueChange = { repairPriceRub = it.filter(Char::isDigit).take(10) },
                        label = { Text("Согласованная с клиентом цена ремонта, ₽") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        shape = RoundedCornerShape(12.dp),
                    )
                }
                Text("Оплата мастеру", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(selected = paymentMethod == "CASH", onClick = { paymentMethod = "CASH" })
                    Text("Наличными", fontSize = 11.sp, color = UtpInk)
                    RadioButton(selected = paymentMethod == "BANK_TRANSFER", onClick = { paymentMethod = "BANK_TRANSFER" })
                    Text("Переводом", fontSize = 11.sp, color = UtpInk)
                }
                val price = if (repairAgreed) repairPriceRub.toIntOrNull() ?: 0 else 0
                val total = price + order.diagnosisFeeRub + order.visitFeeRub
                Text(
                    "Итого: $total ₽ (ремонт${if (order.diagnosisCompletedAt != null) " + диагностика" else ""}${if (order.visitFeeRub > 0) " + выезд" else ""})",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Bold,
                    color = UtpBlue,
                )
                Button(
                    onClick = { showPaymentConfirmation = true },
                    enabled = total > 0 && (!repairAgreed || price > 0) && (repairAgreed || order.diagnosisCompletedAt != null),
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Записать оплату и закрыть заявку") }
            }

            if (!isHomeVisit && isAssignedTechnician && order.status == "IN_PROGRESS") {
                if (order.technicianRepairCompletedAt != null) {
                    Text("Мастер отметил завершение работ. Ожидается выдача администратором.", fontSize = 12.sp, color = UtpBlue)
                } else {
                    Button(
                        onClick = {
                            runAction({ ApiClient.markTechnicianRepairCompleted(token, order.id) }) {}
                        },
                        enabled = canCompleteWork,
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        Text(
                            if (!canCompleteWork) "Сначала подтвердите смету и акт администратором"
                            else "Отметить ремонт завершённым",
                        )
                    }
                    Text("Статус «Готова к выдаче» после проверки выставляет администратор.", fontSize = 11.sp, color = UtpMuted)
                }
            }
        }
    }

    if (showPickupConfirmation) {
        AlertDialog(
            onDismissRequest = { showPickupConfirmation = false },
            title = { Text("Перевозка в сервис") },
            text = { Text("Подтвердите, что клиент согласен, чтобы мастер забрал технику в сервис.") },
            confirmButton = {
                TextButton(onClick = {
                    showPickupConfirmation = false
                    runAction({ ApiClient.consentRepairVisitPickup(token, order.id) }) {}
                }) { Text("Подтвердить") }
            },
            dismissButton = {
                TextButton(onClick = { showPickupConfirmation = false }) { Text("Отмена") }
            },
        )
    }
    if (showDiagnosisConfirmation) {
        AlertDialog(
            onDismissRequest = { showDiagnosisConfirmation = false },
            title = { Text("Диагностика") },
            text = { Text("Подтвердите, что мастер фактически провёл диагностику. К заявке будет добавлено 850 ₽ один раз.") },
            confirmButton = {
                TextButton(onClick = {
                    showDiagnosisConfirmation = false
                    runAction({ ApiClient.completeRepairDiagnosis(token, order.id) }) {}
                }) { Text("Подтвердить") }
            },
            dismissButton = {
                TextButton(onClick = { showDiagnosisConfirmation = false }) { Text("Отмена") }
            },
        )
    }
    if (showPaymentConfirmation) {
        val price = if (repairAgreed) repairPriceRub.toIntOrNull() ?: 0 else 0
        val total = price + order.diagnosisFeeRub + order.visitFeeRub
        AlertDialog(
            onDismissRequest = { showPaymentConfirmation = false },
            title = { Text("Подтвердите оплату на месте") },
            text = { Text("Клиент согласовал сумму $total ₽ и оплатил ${if (paymentMethod == "CASH") "наличными" else "переводом"}?") },
            confirmButton = {
                TextButton(onClick = {
                    showPaymentConfirmation = false
                    runAction({
                        ApiClient.completeOnsiteRepair(token, order.id, repairAgreed, price, paymentMethod)
                    }) {}
                }) { Text("Подтвердить оплату") }
            },
            dismissButton = {
                TextButton(onClick = { showPaymentConfirmation = false }) { Text("Отмена") }
            },
        )
    }
}
