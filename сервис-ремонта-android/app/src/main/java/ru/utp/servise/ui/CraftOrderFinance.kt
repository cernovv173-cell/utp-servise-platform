package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.CraftOrder
import ru.utp.servise.data.StaffMember

private val craftStatuses = listOf(
    "REQUESTED" to "Новая",
    "ACCEPTED" to "Принята",
    "IN_PROGRESS" to "В работе",
    "COMPLETED" to "Завершена",
    "CANCELLED" to "Отменена",
)

private val craftPaymentMethods = listOf(
    "CASH" to "Наличные",
    "CARD_TERMINAL" to "Карта",
    "BANK_TRANSFER" to "Перевод",
    "OTHER" to "Другое",
)

@Composable
internal fun CraftOrderAdminControls(
    order: CraftOrder,
    staff: List<StaffMember>,
    token: String,
    runAction: RunAction,
    refresh: () -> Unit,
) {
    var technicianId by remember(order.id, order.assignedTechnicianId) {
        mutableStateOf(order.assignedTechnicianId.orEmpty())
    }
    var unitPrice by remember(order.id, order.quotedPriceRub, order.unitPriceRub) {
        mutableStateOf((order.quotedPriceRub ?: order.unitPriceRub).toString())
    }
    var status by remember(order.id, order.status) { mutableStateOf(order.status) }
    var showTechnicians by remember(order.id) { mutableStateOf(false) }
    var showStatuses by remember(order.id) { mutableStateOf(false) }
    val price = unitPrice.toIntOrNull()
    val selectedTechnician = staff.firstOrNull { it.id == technicianId }

    Column(
        Modifier.fillMaxWidth().padding(top = 8.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        OutlinedButton(
            onClick = { showTechnicians = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
        ) {
            Text(
                selectedTechnician?.let { "Мастер: ${it.displayName} · ${it.salaryRatePercent}%" }
                    ?: order.assignedTechnicianName?.let { "Мастер: $it" }
                    ?: "Назначить мастера",
            )
        }
        DropdownMenu(
            expanded = showTechnicians,
            onDismissRequest = { showTechnicians = false },
        ) {
            DropdownMenuItem(
                text = { Text("Без мастера") },
                onClick = {
                    technicianId = ""
                    showTechnicians = false
                },
            )
            staff.filter { it.role == "TECHNICIAN" && it.active }.forEach { member ->
                DropdownMenuItem(
                    text = { Text("${member.displayName} · ${member.salaryRatePercent}%") },
                    onClick = {
                        technicianId = member.id
                        showTechnicians = false
                    },
                )
            }
        }

        OutlinedTextField(
            value = unitPrice,
            onValueChange = { value -> unitPrice = value.filter(Char::isDigit).take(8) },
            label = { Text("Цена за штуку, ₽") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedButton(
            onClick = { showStatuses = true },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
        ) {
            Text("Статус: ${craftStatuses.firstOrNull { it.first == status }?.second ?: status}")
        }
        DropdownMenu(
            expanded = showStatuses,
            onDismissRequest = { showStatuses = false },
        ) {
            craftStatuses.forEach { (value, label) ->
                DropdownMenuItem(
                    text = { Text(label) },
                    onClick = {
                        status = value
                        showStatuses = false
                    },
                )
            }
        }
        Button(
            onClick = {
                runAction({
                    ApiClient.saveCraftOrderTerms(
                        token = token,
                        orderId = order.id,
                        quotedPriceRub = price ?: 0,
                        assignedTechnicianId = technicianId.ifBlank { null },
                        status = status,
                    )
                }) { refresh() }
            },
            enabled = price != null && price in 0..10_000_000,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text("Сохранить заявку")
        }
    }
}

@Composable
internal fun CraftOrderFinancePanel(
    order: CraftOrder,
    role: String,
    token: String,
    loyaltyBalance: Int,
    runAction: RunAction,
    refresh: () -> Unit,
) {
    var paymentMethod by remember(order.id) { mutableStateOf("CASH") }
    var showPaymentMethods by remember(order.id) { mutableStateOf(false) }
    val receipt = order.receipt

    if (order.assignedTechnicianName != null) {
        Text(
            "Назначенный мастер: ${order.assignedTechnicianName}${order.assignedTechnicianRatePercent?.let { " · $it%" }.orEmpty()}",
            fontSize = 12.sp,
            color = UtpMuted,
            modifier = Modifier.padding(top = 6.dp),
        )
    }
    if (receipt != null) {
        Card(
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            shape = RoundedCornerShape(14.dp),
            colors = CardDefaults.cardColors(containerColor = UtpPale),
        ) {
            Column(
                Modifier.fillMaxWidth().padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(5.dp),
            ) {
                Text("Чек ${receipt.receiptNumber}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("Сервисный номер: ${receipt.serviceNumber}", fontSize = 11.sp, color = UtpMuted)
                receipt.items.forEach { item ->
                    Row(Modifier.fillMaxWidth()) {
                        Text(
                            "${item.name} × ${item.quantity}",
                            modifier = Modifier.weight(1f),
                            fontSize = 11.sp,
                            color = UtpInk,
                        )
                        Text("${item.totalRub} ₽", fontSize = 11.sp, color = UtpInk)
                    }
                }
                Text("Итого: ${receipt.totalRub} ₽", fontSize = 12.sp, fontWeight = FontWeight.Medium, color = UtpInk)
                if (receipt.bonusDiscountRub > 0) {
                    Text("Списано бонусами: ${receipt.bonusDiscountRub} ₽", fontSize = 11.sp, color = UtpBlue)
                }
                Text(
                    "К оплате: ${receipt.totalRub - receipt.bonusDiscountRub} ₽",
                    fontSize = 14.sp,
                    fontWeight = FontWeight.Bold,
                    color = UtpBlue,
                )
                Text(
                    "Оплата: ${if (receipt.paymentStatus == "PAID") "Оплачено" else "Ожидает оплаты"}${receipt.paymentMethod?.let { " · ${craftPaymentLabel(it)}" }.orEmpty()}",
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
                if (role == "ADMIN" && order.salaryEntry != null) {
                    Text(
                        "Начисление мастеру: ${order.salaryEntry.salaryRub} ₽ (${order.salaryEntry.ratePercent}% от работ)",
                        fontSize = 11.sp,
                        color = UtpMuted,
                    )
                }
                if (role == "CUSTOMER" && receipt.paymentStatus == "PENDING") {
                    val maximumDiscount = minOf(loyaltyBalance.coerceAtLeast(0), receipt.totalRub * 30 / 100)
                    Text(
                        "Баланс бонусов: $loyaltyBalance ₽ · максимум к списанию: $maximumDiscount ₽",
                        fontSize = 11.sp,
                        color = UtpMuted,
                    )
                    OutlinedButton(
                        onClick = {
                            runAction({
                                ApiClient.requestCraftBonusRedemption(token, order.id, !order.redeemBonuses)
                            }) { refresh() }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (order.redeemBonuses) "Не использовать бонусы" else "Использовать бонусы при оплате")
                    }
                }
                if (role == "CUSTOMER" && receipt.paymentStatus == "PAID") {
                    val cashPaid = (receipt.totalRub - receipt.bonusDiscountRub).coerceAtLeast(0)
                    Text(
                        "За денежную оплату начислено ${cashPaid * 5 / 100} бонусов (5%).",
                        fontSize = 11.sp,
                        color = UtpBlue,
                    )
                }
                if (role == "ADMIN" && receipt.paymentStatus == "PENDING") {
                    OutlinedButton(
                        onClick = { showPaymentMethods = true },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Способ оплаты: ${craftPaymentLabel(paymentMethod)}")
                    }
                    DropdownMenu(
                        expanded = showPaymentMethods,
                        onDismissRequest = { showPaymentMethods = false },
                    ) {
                        craftPaymentMethods.forEach { (value, label) ->
                            DropdownMenuItem(
                                text = { Text(label) },
                                onClick = {
                                    paymentMethod = value
                                    showPaymentMethods = false
                                },
                            )
                        }
                    }
                    Button(
                        onClick = {
                            runAction({
                                ApiClient.markCraftReceiptPaid(token, order.id, paymentMethod)
                            }) { refresh() }
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text("Подтвердить получение оплаты")
                    }
                }
            }
        }
    }
}

private fun craftPaymentLabel(value: String): String =
    craftPaymentMethods.firstOrNull { it.first == value }?.second ?: value
