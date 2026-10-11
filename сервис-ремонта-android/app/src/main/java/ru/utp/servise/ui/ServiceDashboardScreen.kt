package ru.utp.servise.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.utp.servise.data.ApiClient
import ru.utp.servise.data.OperationsDashboard

@Composable
fun ServiceDashboardScreen(token: String, onError: (String) -> Unit) {
    var dashboard by remember { mutableStateOf<OperationsDashboard?>(null) }
    var loading by remember { mutableStateOf(true) }

    LaunchedEffect(token) {
        loading = true
        runCatching { withContext(Dispatchers.IO) { ApiClient.operationsDashboard(token) } }
            .onSuccess { dashboard = it }
            .onFailure { onError(it.message ?: "Не удалось загрузить показатели сервиса.") }
        loading = false
    }

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Обзор сервиса", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("За последние 30 дней", fontSize = 13.sp, color = UtpMuted)
        if (loading) Text("Загружаем показатели…", color = UtpMuted)
        dashboard?.let { data ->
            val metrics = listOf(
                "Активные заявки" to data.activeOrders,
                "Просроченные" to data.overdueOrders,
                "Новые заявки" to data.newOrders,
                "Завершённые ремонты" to data.completedOrders,
            )
            metrics.chunked(2).forEach { row ->
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    row.forEach { (title, value) ->
                        MetricCard(title, value.toString(), Modifier.weight(1f))
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                MetricCard("Среднее время ремонта", formatMinutes(data.averageRepairMinutes), Modifier.weight(1f))
                MetricCard("Оплачено", "${data.collectedRub} ₽", Modifier.weight(1f))
            }
            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(17.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(9.dp)) {
                    Text("Популярные работы", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    if (data.popularWorks.isEmpty()) {
                        Text("За период нет завершённых работ.", fontSize = 12.sp, color = UtpMuted)
                    } else {
                        data.popularWorks.forEachIndexed { index, work ->
                            Row(Modifier.fillMaxWidth()) {
                                Text("${index + 1}. ${work.name}", Modifier.weight(1f), fontSize = 12.sp, color = UtpInk)
                                Text("${work.completedQuantity} шт.", fontSize = 12.sp, color = UtpMuted)
                            }
                        }
                    }
                }
            }
            Text(
                "Сумма учитывает оплаченные чеки; среднее время — от создания заявки до завершения.",
                fontSize = 11.sp,
                color = UtpMuted,
            )
        }
    }
}

@Composable
private fun MetricCard(title: String, value: String, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(13.dp)) {
            Text(title, fontSize = 11.sp, color = UtpMuted)
            Text(value, modifier = Modifier.padding(top = 5.dp), fontSize = 19.sp, fontWeight = FontWeight.Bold, color = UtpBlue)
        }
    }
}

private fun formatMinutes(minutes: Int?): String {
    if (minutes == null) return "Нет данных"
    if (minutes < 60) return "$minutes мин"
    val hours = minutes / 60
    val days = hours / 24
    return if (days > 0) "$days дн. ${hours % 24} ч" else "$hours ч ${minutes % 60} мин"
}
