package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.RepairOrderReleaseSummary

@Composable
internal fun RepairOrderReleaseDialog(
    order: RepairOrder,
    token: String,
    runAction: RunAction,
    onDismiss: () -> Unit,
) {
    val scope = rememberCoroutineScope()
    var summary by remember(order.id) { mutableStateOf<RepairOrderReleaseSummary?>(null) }
    var loading by remember(order.id) { mutableStateOf(true) }
    var error by remember(order.id) { mutableStateOf<String?>(null) }
    var selectedMethod by remember(order.id) { mutableStateOf("CASH") }
    var paymentMenuExpanded by remember { mutableStateOf(false) }

    fun loadSummary() {
        scope.launch {
            loading = true
            error = null
            try {
                summary = withContext(Dispatchers.IO) {
                    ApiClient.repairOrderReleaseSummary(token, order.id)
                }
                selectedMethod = summary?.paymentMethod ?: selectedMethod
            } catch (failure: Throwable) {
                error = failure.message ?: "Не удалось получить сумму заказа."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(order.id) { loadSummary() }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Выдать заказ · ${order.serviceNumber}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    loading -> Text("Проверяем итоговую сумму…")
                    summary != null -> {
                        val totals = summary!!
                        Text("Стоимость ремонта: ${totals.totalRub} ₽", color = UtpInk)
                        if (totals.bonusDiscountRub > 0) {
                            Text("Списываем бонусами: ${totals.bonusDiscountRub} ₽", color = UtpMuted)
                        }
                        Text(
                            "К оплате: ${totals.amountDueRub} ₽",
                            color = UtpBlue,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        if (totals.paymentStatus == "PAID") {
                            Text(
                                "Заказ уже оплачен${totals.paymentMethod?.let { " · ${it.paymentMethodLabel()}" }.orEmpty()}.",
                                color = UtpMuted,
                                fontSize = 12.sp,
                            )
                        } else if (totals.amountDueRub > 0) {
                            Text("Способ оплаты", fontWeight = FontWeight.SemiBold, color = UtpInk)
                            OutlinedButton(
                                onClick = { paymentMenuExpanded = true },
                                modifier = Modifier.fillMaxWidth(),
                            ) { Text(selectedMethod.paymentMethodLabel()) }
                            DropdownMenu(
                                expanded = paymentMenuExpanded,
                                onDismissRequest = { paymentMenuExpanded = false },
                            ) {
                                (totals.paymentMethods.ifEmpty { listOf("CASH", "CARD_TERMINAL", "BANK_TRANSFER", "OTHER") })
                                    .forEach { method ->
                                        DropdownMenuItem(
                                            text = { Text(method.paymentMethodLabel()) },
                                            onClick = {
                                                selectedMethod = method
                                                paymentMenuExpanded = false
                                            },
                                        )
                                    }
                            }
                        } else {
                            Text("Сумма полностью покрыта бонусами.", color = UtpMuted, fontSize = 12.sp)
                        }
                    }
                }
                error?.let { message ->
                    Text(message, color = androidx.compose.material3.MaterialTheme.colorScheme.error, fontSize = 12.sp)
                    TextButton(onClick = ::loadSummary, enabled = !loading) { Text("Повторить проверку суммы") }
                }
                Text(
                    "После подтверждения оплата и выдача будут записаны в заказе, а гарантийный талон сохранится в документах.",
                    color = UtpMuted,
                    fontSize = 12.sp,
                )
            }
        },
        confirmButton = {
            val current = summary
            Button(
                enabled = !loading && current != null && error == null &&
                    (current.amountDueRub == 0 || current.paymentStatus == "PAID" || selectedMethod in current.paymentMethods),
                onClick = {
                    current?.let { totals ->
                        runAction({
                            ApiClient.releaseRepairOrder(
                                token = token,
                                orderId = order.id,
                                expectedAmountRub = totals.amountDueRub,
                                paymentMethod = if (totals.amountDueRub > 0 && totals.paymentStatus != "PAID") selectedMethod else null,
                            )
                        }) { onDismiss() }
                    }
                },
            ) { Text("Подтвердить выдачу") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } },
    )
}

private fun String.paymentMethodLabel(): String = when (this) {
    "CASH" -> "Наличные"
    "CARD_TERMINAL" -> "Банковская карта"
    "BANK_TRANSFER" -> "Перевод"
    "OTHER" -> "Другой способ"
    else -> this
}
