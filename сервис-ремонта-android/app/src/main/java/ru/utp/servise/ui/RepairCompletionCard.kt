package ru.utp.servise.ui

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.R
import ru.utp.servise.data.RepairOrder

@Composable
internal fun RepairCompletionCard(order: RepairOrder, onReview: (String) -> Unit) {
    var showTipInformation by remember(order.id) { mutableStateOf(false) }
    val warranty = order.warranty
    val repairSummary = warranty?.repairSummary?.takeIf { it.isNotBlank() }
        ?: order.items.asSequence()
            .filter { it.type == "SERVICE" }
            .map { it.name.trim() }
            .filter { it.isNotBlank() }
            .joinToString(", ")
            .ifBlank { "Работы перечислены в заказ-наряде." }

    Card(
        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
    ) {
        Column(
            modifier = Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Image(
                    painter = painterResource(R.drawable.raccoon_welcome),
                    contentDescription = "Енот-сервис поздравляет с завершением ремонта",
                    modifier = Modifier.size(68.dp).clip(CircleShape),
                    contentScale = ContentScale.Crop,
                )
                Column(modifier = Modifier.padding(start = 12.dp)) {
                    Text(
                        "Техника снова в строю!",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.Bold,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    Text(
                        "Ремонт завершён · ${order.serviceNumber}",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                        modifier = Modifier.padding(top = 3.dp),
                    )
                }
            }

            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    "Выполненные работы",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                Text(repairSummary, fontSize = 13.sp, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }

            Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(
                    "Гарантия",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
                if (warranty == null) {
                    Text(
                        "Информация о гарантии в заказе не указана.",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                } else {
                    Text(
                        "Талон ${warranty.warrantyNumber} · ${warranty.warrantyDays.warrantyDaysLabel()} · до ${formatWarrantyDate(warranty.expiresAt)}",
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onPrimaryContainer,
                    )
                    if (warranty.terms.isNotBlank()) {
                        Text(
                            "Условия: ${warranty.terms}",
                            fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onPrimaryContainer,
                        )
                    }
                }
            }

            if (order.hasReview) {
                Text(
                    "Спасибо! Ваш отзыв уже отправлен.",
                    fontSize = 13.sp,
                    fontWeight = FontWeight.Medium,
                    color = MaterialTheme.colorScheme.onPrimaryContainer,
                )
            } else {
                Button(
                    onClick = { onReview(order.id) },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text("Оставить отзыв")
                }
            }

            OutlinedButton(
                onClick = { showTipInformation = true },
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(12.dp),
            ) {
                Text("Отправить чаевые")
            }
        }
    }

    if (showTipInformation) {
        AlertDialog(
            onDismissRequest = { showTipInformation = false },
            title = { Text("Чаевые за ремонт · ${order.serviceNumber}") },
            text = {
                Text(
                    "Приём чаевых пока не подключён. Он станет доступен после регистрации и настройки ЮMoney. Сейчас перевод денег не выполняется.",
                )
            },
            confirmButton = {
                TextButton(onClick = { showTipInformation = false }) {
                    Text("Понятно")
                }
            },
        )
    }
}

private fun Int.warrantyDaysLabel(): String {
    val lastTwoDigits = this % 100
    val lastDigit = this % 10
    val unit = when {
        lastTwoDigits in 11..14 -> "дней"
        lastDigit == 1 -> "день"
        lastDigit in 2..4 -> "дня"
        else -> "дней"
    }
    return "$this $unit"
}

private fun formatWarrantyDate(value: String): String {
    val date = value.take(10)
    val parts = date.split('-')
    return if (parts.size == 3) "${parts[2]}.${parts[1]}.${parts[0]}" else date
}
