package ru.utp.servise.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedButton
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
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.FreeSaleReceiptDraftItem
import ru.utp.servise.data.ReceiptDraftItemQuantity

@Composable
internal fun RepairReceiptPanel(
    order: RepairOrder,
    role: String,
    currentUserId: String,
    token: String,
    runAction: RunAction,
) {
    val canManageReceipt = role == "TECHNICIAN" && currentUserId == order.technicianId
    val isWorkshopOrder =
        order.repairLocation == "SERVICE_CENTER" ||
            (order.visitScenarioVersion == 0 && order.repairLocation == null)
    val canManagePayment =
        canManageReceipt || (role == "ADMIN" && isWorkshopOrder)
    var showPaymentMethods by remember(order.id) { mutableStateOf(false) }
    var showReceiptEditor by remember(order.id) { mutableStateOf(false) }
    order.receipt?.let { receipt ->
        Spacer(Modifier.height(10.dp))
        Text("Чек ${receipt.receiptNumber}", fontSize = 14.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
        Text("Сервисный номер: ${receipt.serviceNumber}", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp))
        Text("Клиент: ${receipt.customerName}${receipt.customerPhone?.let { " · $it" }.orEmpty()}", fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 2.dp))
        receipt.items.forEach { item ->
            Row(Modifier.fillMaxWidth().padding(top = 5.dp)) {
                Text("${item.name} × ${item.quantity}", Modifier.weight(1f), fontSize = 11.sp, color = UtpInk)
                Text("${item.totalRub} ₽", fontSize = 11.sp, color = UtpInk)
            }
        }
        Text("Создан: ${receipt.issuedAt.take(10)}", fontSize = 10.sp, color = UtpMuted, modifier = Modifier.padding(top = 5.dp))
        if (receipt.bonusDiscountRub > 0) {
            Text("Оплата бонусами: −${receipt.bonusDiscountRub} ₽", fontSize = 11.sp, color = UtpBlue, modifier = Modifier.padding(top = 5.dp))
        }
        Text("К оплате: ${receipt.totalRub - receipt.bonusDiscountRub} ₽", fontSize = 13.sp, fontWeight = FontWeight.Bold, color = UtpBlue, modifier = Modifier.padding(top = 5.dp))
        Text(
            "Оплата: ${if (receipt.paymentStatus == "PAID") "Оплачено" else "Ожидает оплаты"}${receipt.paymentMethod?.let { " · ${it.paymentMethodLabel()}" }.orEmpty()}",
            fontSize = 11.sp,
            color = if (receipt.paymentStatus == "PAID") UtpBlue else UtpMuted,
            modifier = Modifier.padding(top = 3.dp),
        )
    }

    if (canManagePayment && order.status == "COMPLETED" && order.receipt?.paymentStatus == "PENDING") {
        val serviceTotalRub = order.items
            .filter { it.type == "SERVICE" }
            .sumOf { it.quantity * it.unitPriceRub }
        val maximumServiceDiscount = serviceTotalRub * 3 / 10
        Text(
            "Бонусы списываются только за услуги · лимит до $maximumServiceDiscount ₽",
            fontSize = 11.sp,
            color = UtpMuted,
            modifier = Modifier.padding(top = 6.dp),
        )
        OutlinedButton(
            onClick = { runAction({ ApiClient.requestBonusRedemption(token, order.id, !order.redeemBonuses) }, {}) },
            enabled = maximumServiceDiscount > 0 || order.redeemBonuses,
            modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            shape = RoundedCornerShape(12.dp),
        ) {
            Text(
                if (order.redeemBonuses) "Отменить оплату бонусами"
                else "Списать бонусы за услуги",
            )
        }
    }

    if (
        canManageReceipt && order.status == "COMPLETED" &&
        order.receipt?.paymentStatus != "PAID"
    ) {
        OutlinedButton(
            onClick = { showReceiptEditor = true },
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            shape = RoundedCornerShape(12.dp),
        ) { Text(if (order.receipt == null) "Составить чек" else "Изменить состав чека") }
    }
    if (showReceiptEditor) {
        ReceiptDraftDialog(
            order = order,
            saving = false,
            onDismiss = { showReceiptEditor = false },
            onSave = { quantities: List<ReceiptDraftItemQuantity>, freeSale: FreeSaleReceiptDraftItem? ->
                runAction(
                    {
                        ApiClient.createReceipt(
                            token,
                            order.id,
                            quantities,
                            freeSale,
                        )
                    },
                    { showReceiptEditor = false },
                )
            },
        )
    }
    if (canManagePayment && order.receipt?.paymentStatus == "PENDING") {
        OutlinedButton(
            onClick = { showPaymentMethods = true },
            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
            shape = RoundedCornerShape(12.dp),
        ) { Text("Подтвердить фактическую оплату") }
    }
    if (showPaymentMethods) {
        AlertDialog(
            onDismissRequest = { showPaymentMethods = false },
            title = { Text("Способ фактической оплаты") },
            text = {
                Column {
                    listOf("CASH" to "Наличные", "CARD_TERMINAL" to "Карта через терминал", "BANK_TRANSFER" to "Банковский перевод", "OTHER" to "Другое").forEach { (method, label) ->
                        TextButton(onClick = {
                            runAction({ ApiClient.markReceiptPaid(token, order.id, method) }) { showPaymentMethods = false }
                        }, modifier = Modifier.fillMaxWidth()) { Text(label) }
                    }
                }
            },
            confirmButton = { TextButton(onClick = { showPaymentMethods = false }) { Text("Отмена") } },
        )
    }
}

private fun String.paymentMethodLabel(): String = when (this) {
    "CASH" -> "Наличные"
    "CARD_TERMINAL" -> "Карта через терминал"
    "BANK_TRANSFER" -> "Банковский перевод"
    else -> "Другое"
}
