package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.Alignment
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
    var redeemBonuses by remember(order.id) { mutableStateOf(false) }
    var paymentMenuExpanded by remember { mutableStateOf(false) }

    fun loadSummary() {
        scope.launch {
            loading = true
            error = null
            try {
                val loadedSummary = withContext(Dispatchers.IO) {
                    ApiClient.repairOrderReleaseSummary(token, order.id)
                }
                summary = loadedSummary
                selectedMethod = loadedSummary.paymentMethod ?: selectedMethod
                redeemBonuses = loadedSummary.bonusSelectionAvailable &&
                    loadedSummary.redeemBonuses && loadedSummary.maxBonusDiscountRub > 0
            } catch (failure: Throwable) {
                error = failure.message ?: "Не удалось получить сумму заказа."
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(order.id) { loadSummary() }

    val totals = summary
    val isAlreadyPaid = totals?.paymentStatus == "PAID"
    val supportsBonusSelection = totals?.bonusSelectionAvailable == true
    val bonusDiscountRub = when {
        totals == null -> 0
        isAlreadyPaid == true -> totals.bonusDiscountRub
        supportsBonusSelection && redeemBonuses -> totals.maxBonusDiscountRub
        supportsBonusSelection -> 0
        else -> totals.bonusDiscountRub
    }
    val amountDueRub = when {
        totals == null -> 0
        isAlreadyPaid == true -> 0
        supportsBonusSelection -> (totals.totalRub - bonusDiscountRub).coerceAtLeast(0)
        else -> totals.amountDueRub
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Выдать заказ · ${order.serviceNumber}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                when {
                    loading -> Text("Проверяем итоговую сумму…")
                    totals != null -> {
                        Text("Стоимость ремонта: ${totals.totalRub} ₽", color = UtpInk)
                        if (supportsBonusSelection && !isAlreadyPaid && totals.maxBonusDiscountRub > 0) {
                            Row(
                                modifier = Modifier.fillMaxWidth(),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                            ) {
                                Checkbox(
                                    checked = redeemBonuses,
                                    onCheckedChange = { redeemBonuses = it },
                                )
                                Column {
                                    Text(
                                        "Списать бонусы — до ${totals.maxBonusDiscountRub} ₽",
                                        color = UtpInk,
                                        fontWeight = FontWeight.SemiBold,
                                    )
                                    Text(
                                        "1 балл = 1 ₽; только на услуги, не больше 30% их стоимости.",
                                        color = UtpMuted,
                                        fontSize = 12.sp,
                                    )
                                }
                            }
                        }
                        if (bonusDiscountRub > 0) {
                            Text("Списываем бонусами: $bonusDiscountRub ₽", color = UtpMuted)
                        }
                        Text(
                            "К оплате: $amountDueRub ₽",
                            color = UtpBlue,
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Bold,
                        )
                        if (isAlreadyPaid == true) {
                            Text(
                                "Заказ уже оплачен${totals.paymentMethod?.let { " · ${it.paymentMethodLabel()}" }.orEmpty()}.",
                                color = UtpMuted,
                                fontSize = 12.sp,
                            )
                        } else if (amountDueRub > 0) {
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
                            Text(
                                if (bonusDiscountRub > 0) "Сумма полностью покрыта бонусами."
                                else "Оплата не требуется.",
                                color = UtpMuted,
                                fontSize = 12.sp,
                            )
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
            val current = totals
            Button(
                enabled = !loading && current != null && error == null &&
                    (amountDueRub == 0 || current.paymentStatus == "PAID" || selectedMethod in current.paymentMethods),
                onClick = {
                    current?.let { totals ->
                        runAction({
                            ApiClient.releaseRepairOrder(
                                token = token,
                                orderId = order.id,
                                expectedAmountRub = amountDueRub,
                                paymentMethod = if (amountDueRub > 0 && totals.paymentStatus != "PAID") selectedMethod else null,
                                redeemBonuses = if (totals.bonusSelectionAvailable && totals.paymentStatus != "PAID") redeemBonuses else null,
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
