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
import ru.utp.servise.data.ShopOrder

internal fun deliveryAreaLabel(area: String?): String = when (area) {
    "MOSCOW" -> "Москва"
    "MOSCOW_REGION" -> "Московская область"
    else -> "Регион не указан"
}

@Composable
internal fun CustomerShopDeliveryForm(
    deliveryMethod: String,
    onDeliveryMethodChange: (String) -> Unit,
    deliveryCity: String,
    onDeliveryCityChange: (String) -> Unit,
    deliveryAddress: String,
    onDeliveryAddressChange: (String) -> Unit,
    deliveryRequestNote: String,
    onDeliveryRequestNoteChange: (String) -> Unit,
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("Получение заказа", fontWeight = FontWeight.SemiBold, color = UtpInk)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (deliveryMethod == "PICKUP") {
                Button(onClick = { onDeliveryMethodChange("PICKUP") }, modifier = Modifier.weight(1f)) {
                    Text("Самовывоз")
                }
            } else {
                OutlinedButton(onClick = { onDeliveryMethodChange("PICKUP") }, modifier = Modifier.weight(1f)) {
                    Text("Самовывоз")
                }
            }
            if (deliveryMethod == "COURIER") {
                Button(onClick = { onDeliveryMethodChange("COURIER") }, modifier = Modifier.weight(1f)) {
                    Text("Доставка")
                }
            } else {
                OutlinedButton(onClick = { onDeliveryMethodChange("COURIER") }, modifier = Modifier.weight(1f)) {
                    Text("Доставка")
                }
            }
        }
        if (deliveryMethod == "COURIER") {
            Text(
                "Курьер — по Пушкино и ближайшему Подмосковью. Укажите населённый пункт: администратор проверит адрес и отдельно предложит цену и срок.",
                fontSize = 12.sp,
                color = UtpMuted,
            )
            OutlinedTextField(
                value = deliveryCity,
                onValueChange = { onDeliveryCityChange(it.take(120)) },
                label = { Text("Населённый пункт") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
            )
            OutlinedTextField(
                value = deliveryAddress,
                onValueChange = { onDeliveryAddressChange(it.take(500)) },
                label = { Text("Улица, дом, квартира") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
                singleLine = true,
            )
            OutlinedTextField(
                value = deliveryRequestNote,
                onValueChange = { onDeliveryRequestNoteChange(it.take(500)) },
                label = { Text("Комментарий курьеру (необязательно)") },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
            )
            Text(
                "Самовывоз доступен из Пушкино. Для более дальнего адреса администратор сообщит, сможем ли доставить.",
                fontSize = 11.sp,
                color = UtpMuted,
            )
        }
    }
}

@Composable
internal fun CustomerShopOrderCard(
    order: ShopOrder,
    onAcceptDelivery: () -> Unit,
    onDeclineDelivery: () -> Unit,
    onCancelPickup: () -> Unit,
    isBusy: Boolean,
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text("Заказ #${order.id.take(8)}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text(customerShopOrderStatus(order.status), color = UtpBlue, fontSize = 12.sp)
            }
            order.items.forEach { item ->
                Text("${item.name} × ${item.quantity} — ${shopDeliveryPrice(item.quantity * item.unitPriceRub)}", fontSize = 12.sp, color = UtpMuted)
            }
            Text("Товары: ${shopDeliveryPrice(order.totalRub)}", fontWeight = FontWeight.SemiBold, color = UtpInk)
            if (order.deliveryMethod == "COURIER") {
                Text("Доставка · ${deliveryAreaLabel(order.deliveryArea)}", fontWeight = FontWeight.Medium, color = UtpInk)
                Text("${order.deliveryCity.orEmpty()}, ${order.deliveryAddress.orEmpty()}", fontSize = 12.sp, color = UtpMuted)
                order.deliveryRequestNote?.takeIf { it.isNotBlank() }?.let {
                    Text("Комментарий курьеру: $it", fontSize = 12.sp, color = UtpMuted)
                }
                val fee = order.deliveryFeeRub
                val window = order.deliveryWindow
                if (fee == null || window.isNullOrBlank()) {
                    Text("Администратор проверяет адрес и подготовит предложение по доставке.", fontSize = 12.sp, color = UtpMuted)
                } else {
                    Text("Доставка: ${shopDeliveryPrice(fee)} · $window", fontSize = 12.sp, color = UtpMuted)
                    Text("Итого с доставкой: ${shopDeliveryPrice(order.totalRub + fee)}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    when {
                        order.deliveryOfferAcceptedAt != null -> Text("Вы согласились с ценой и сроком. Заказ ожидает подтверждения наличия.", fontSize = 12.sp, color = UtpMuted)
                        order.status == "PENDING" -> {
                            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(onClick = onAcceptDelivery, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                                    Text("Согласен")
                                }
                                OutlinedButton(onClick = onDeclineDelivery, modifier = Modifier.weight(1f), shape = RoundedCornerShape(12.dp)) {
                                    Text("Отказаться")
                                }
                            }
                        }
                    }
                }
            }
            if (order.deliveryMethod == "PICKUP" && order.status == "PENDING") {
                Text(
                    "Самовывоз можно отменить до подтверждения наличия.",
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
                OutlinedButton(
                    onClick = onCancelPickup,
                    enabled = !isBusy,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(if (isBusy) "Отменяем…" else "Отменить самовывоз")
                }
            }
        }
    }
}

@Composable
internal fun AdminShopDeliveryOfferEditor(
    order: ShopOrder,
    busy: Boolean,
    onOffer: (Int, String) -> Unit,
) {
    var feeText by remember(order.id, order.deliveryFeeRub) {
        mutableStateOf(order.deliveryFeeRub?.toString().orEmpty())
    }
    var window by remember(order.id, order.deliveryWindow) {
        mutableStateOf(order.deliveryWindow.orEmpty())
    }
    val fee = feeText.toIntOrNull()

    Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
        Text(
            if (order.deliveryOfferAcceptedAt == null) "Предложите стоимость и срок доставки" else "Клиент принял предложение",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = UtpInk,
        )
        OutlinedTextField(
            value = feeText,
            onValueChange = { feeText = it.filter(Char::isDigit).take(7) },
            label = { Text("Стоимость доставки, ₽") },
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
        )
        OutlinedTextField(
            value = window,
            onValueChange = { window = it.take(160) },
            label = { Text("Срок или интервал доставки") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
        )
        Button(
            onClick = { fee?.let { onOffer(it, window.trim()) } },
            enabled = !busy && fee != null && fee >= 0 && window.trim().length >= 3,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
        ) {
            Text(if (order.deliveryFeeRub == null) "Отправить предложение" else "Обновить предложение")
        }
        if (order.deliveryOfferAcceptedAt != null) {
            Text("Изменение предложения потребует повторного согласия клиента.", fontSize = 11.sp, color = UtpMuted)
        }
    }
}

private fun customerShopOrderStatus(status: String): String = when (status) {
    "PENDING" -> "Ожидает подтверждения"
    "CONFIRMED" -> "Наличие подтверждено"
    "COMPLETED" -> "Выдан"
    "CANCELLED" -> "Отменён"
    else -> status
}

private fun shopDeliveryPrice(amount: Int): String =
    "${java.text.NumberFormat.getIntegerInstance(java.util.Locale("ru", "RU")).format(amount)} ₽"
