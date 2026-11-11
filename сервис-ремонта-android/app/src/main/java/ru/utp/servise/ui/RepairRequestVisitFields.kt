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
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.RadioButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
internal fun RepairRequestVisitFields(
    repairLocation: String,
    onRepairLocationChange: (String) -> Unit,
    isWithinCity: Boolean,
    onWithinCityChange: (Boolean) -> Unit,
    distanceKm: String,
    onDistanceKmChange: (String) -> Unit,
) {
    val visitEstimate = distanceKm.toIntOrNull()?.takeIf { it > 0 }?.times(25) ?: 0

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
    ) {
        Column(Modifier.fillMaxWidth().padding(14.dp)) {
            Text("Как передать технику", fontWeight = FontWeight.SemiBold, fontSize = 15.sp, color = UtpInk)
            listOf("SERVICE_CENTER" to "Привезу в сервис", "CUSTOMER_ADDRESS" to "Нужен выезд мастера").forEach { (value, title) ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    RadioButton(
                        selected = repairLocation == value,
                        onClick = { onRepairLocationChange(value) },
                    )
                    Text(title, fontSize = 13.sp, color = UtpInk)
                }
            }

            if (repairLocation == "CUSTOMER_ADDRESS") {
                Spacer(Modifier.height(6.dp))
                Text(
                    "Базовый город — Пушкино Московской области. В пределах города выезд бесплатный.",
                    fontSize = 12.sp,
                    color = UtpMuted,
                )
                listOf(true to "В пределах Пушкино", false to "За пределами Пушкино").forEach { (value, title) ->
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        RadioButton(
                            selected = isWithinCity == value,
                            onClick = { onWithinCityChange(value) },
                        )
                        Text(title, fontSize = 12.sp, color = UtpInk)
                    }
                }
                if (!isWithinCity) {
                    OutlinedTextField(
                        value = distanceKm,
                        onValueChange = { onDistanceKmChange(it.filter(Char::isDigit).take(5)) },
                        label = { Text("Примерно от границы Пушкино, км") },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        shape = RoundedCornerShape(12.dp),
                    )
                    if (visitEstimate > 0) {
                        Text(
                            "Предварительно за выезд: $visitEstimate ₽ · 25 ₽/км в одну сторону",
                            fontSize = 12.sp,
                            fontWeight = FontWeight.SemiBold,
                            color = UtpBlue,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                    }
                } else {
                    Text("Выезд — 0 ₽", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpBlue)
                }
                Text(
                    "Клиент указывает расстояние ориентировочно. Перед диагностикой мастер или администратор вручную сверит город и километраж по Яндекс Картам.",
                    fontSize = 11.sp,
                    color = UtpMuted,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }

            Text(
                "Диагностика — 850 ₽ только если мастер её проведёт. Если диагностики не было, плата за выезд не начисляется. Эти суммы нельзя оплатить бонусами.",
                fontSize = 11.sp,
                color = UtpMuted,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}
