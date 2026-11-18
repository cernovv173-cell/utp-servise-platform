package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedTextField
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
import ru.utp.servise.data.CustomerServicePrice

@Composable
internal fun ServicePriceGuide(
    prices: List<CustomerServicePrice>,
    deviceType: String,
) {
    var expanded by remember { mutableStateOf(false) }
    var search by remember { mutableStateOf("") }
    val applicablePrices = prices.filter { deviceType in it.deviceTypes }
    val diagnosticTerms = when (deviceType) {
        "COMPUTER", "MONOBLOCK" -> listOf("диагностика пк", "диагностика комплектующих")
        "LAPTOP" -> listOf("диагностика ноутбука")
        else -> emptyList()
    }
    val featured = applicablePrices.filter { price ->
        price.name.startsWith("Вызов к заказчику", ignoreCase = true) ||
            diagnosticTerms.any { term -> price.name.contains(term, ignoreCase = true) }
    }
    val visiblePrices = if (search.isBlank()) applicablePrices else applicablePrices.filter {
        it.name.contains(search.trim(), ignoreCase = true)
    }

    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(14.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text("Ориентиры по прайсу до выезда", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text(
                "Это активные цены за конкретные услуги из прайса, а не диагноз или обещание, что такая работа решит вашу неисправность.",
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = UtpMuted,
            )
            if (featured.isNotEmpty()) {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    featured.forEach { price -> ServicePriceRow(price) }
                }
            } else if (prices.isEmpty()) {
                Text("Не удалось загрузить активный прайс; мы не подменяем его придуманными ценами.", fontSize = 12.sp, color = UtpMuted)
            } else if (applicablePrices.isEmpty()) {
                Text("В прайсе нет услуг, предназначенных для этого типа устройства.", fontSize = 12.sp, color = UtpMuted)
            } else {
                Text("Для этого типа устройства в прайсе нет отдельной позиции диагностики.", fontSize = 12.sp, color = UtpMuted)
            }
            Text(
                "Выезд, диагностика, работы и запчасти не складываются здесь в предполагаемую сумму: сервис отдельно подтвердит, какие позиции нужны и применимы.",
                fontSize = 12.sp,
                lineHeight = 17.sp,
                color = UtpMuted,
            )
            TextButton(onClick = { expanded = !expanded }, modifier = Modifier.fillMaxWidth()) {
                Text(if (expanded) "Скрыть прайс" else "Найти конкретную работу в прайсе")
            }
            if (expanded) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it.take(160) },
                    label = { Text("Поиск услуги") },
                    placeholder = { Text("Например, замена матрицы") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    shape = RoundedCornerShape(13.dp),
                )
                if (visiblePrices.isEmpty()) {
                    Text("Активная услуга не найдена.", fontSize = 12.sp, color = UtpMuted)
                } else {
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        visiblePrices.forEach { price -> ServicePriceRow(price) }
                    }
                }
            }
            Text(
                "После диагностики сервис подготовит точную смету. До начала и при изменении работ её проверит и подтвердит администратор.",
                modifier = Modifier.padding(top = 3.dp),
                fontSize = 12.sp,
                lineHeight = 17.sp,
                fontWeight = FontWeight.Medium,
                color = UtpInk,
            )
        }
    }
}

@Composable
private fun ServicePriceRow(price: CustomerServicePrice) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(price.name, modifier = Modifier.weight(1f).padding(end = 8.dp), fontSize = 12.sp, color = UtpInk)
        Text("${price.unitPriceRub} ₽", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpBlue)
    }
}
