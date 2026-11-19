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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import ru.utp.servise.data.RepairOrder
import ru.utp.servise.data.ScheduledRepairOrder
import ru.utp.servise.data.deviceLabel
import ru.utp.servise.data.statusLabel
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Locale

@Composable
fun RepairScheduleScreen(
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onError: (String) -> Unit,
    onOpenOrders: () -> Unit,
) {
    var weekOffset by remember { mutableStateOf(0L) }
    var orders by remember { mutableStateOf<List<ScheduledRepairOrder>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    val zone = ZoneId.systemDefault()
    val monday = LocalDate.now(zone).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).plusWeeks(weekOffset)
    val from = monday.atStartOfDay(zone).toOffsetDateTime().toString()
    val to = monday.plusWeeks(1).atStartOfDay(zone).toOffsetDateTime().toString()

    LaunchedEffect(token, weekOffset) {
        loading = true
        runCatching { withContext(Dispatchers.IO) { ApiClient.repairSchedule(token, from, to) } }
            .onSuccess { orders = it }
            .onFailure { onError(it.message ?: "Не удалось загрузить расписание.") }
        loading = false
    }

    val grouped = orders.sortedBy { it.preferredAt.orEmpty() }.groupBy { order ->
        order.preferredAt?.let(::localDateTime)?.toLocalDate() ?: monday
    }
    val workload = orders.groupingBy { it.technicianName ?: "Мастер не назначен" }.eachCount()
    val rangeFormatter = DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("ru-RU"))
    val dayFormatter = DateTimeFormatter.ofPattern("EEEE, d MMMM", Locale.forLanguageTag("ru-RU"))

    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("Расписание мастеров", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text("Клиентское время предварительное — уточните его перед выездом.", fontSize = 12.sp, color = UtpMuted)
        Card(
            shape = RoundedCornerShape(16.dp),
            colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
        ) {
            Row(Modifier.fillMaxWidth().padding(horizontal = 9.dp, vertical = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { weekOffset -= 1 }) { Text("‹") }
                Column(Modifier.weight(1f).padding(top = 7.dp)) {
                    Text("${monday.format(rangeFormatter)} — ${monday.plusDays(6).format(rangeFormatter)}", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    Text("${orders.size} заявок с выбранным временем", fontSize = 11.sp, color = UtpMuted)
                }
                TextButton(onClick = { weekOffset = 0L }) { Text("Сегодня") }
                TextButton(onClick = { weekOffset += 1 }) { Text("›") }
            }
        }
        if (workload.isNotEmpty()) {
            Card(
                shape = RoundedCornerShape(16.dp),
                colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
            ) {
                Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Text("Загрузка команды", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    workload.forEach { (name, count) ->
                        Row(Modifier.fillMaxWidth()) {
                            Text(name, Modifier.weight(1f), fontSize = 12.sp, color = UtpMuted)
                            Text("$count", fontSize = 12.sp, fontWeight = FontWeight.SemiBold, color = UtpBlue)
                        }
                    }
                }
            }
        }
        if (loading) Text("Загружаем расписание…", color = UtpMuted)
        if (!loading && orders.isEmpty()) {
            Card(shape = RoundedCornerShape(16.dp), colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface)) {
                Text("На этой неделе нет заявок с выбранным временем.", Modifier.padding(15.dp), fontSize = 13.sp, color = UtpMuted)
            }
        }
        grouped.toSortedMap().forEach { (date, dayOrders) ->
            Text(date.format(dayFormatter).replaceFirstChar { it.titlecase(Locale.forLanguageTag("ru-RU")) }, fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.padding(top = 4.dp))
            dayOrders.forEach { order ->
                ScheduleOrderCard(
                    order = order,
                    token = token,
                    busy = busy,
                    runAction = runAction,
                    onOrderUpdated = { updated ->
                        val updatedDate = updated.preferredAt?.let(::localDateTime)?.toLocalDate()
                        orders = orders.mapNotNull { current ->
                            if (current.id != updated.id) current
                            else if (updatedDate == null || updatedDate < monday || updatedDate >= monday.plusWeeks(1)) null
                            else current.copy(preferredAt = updated.preferredAt)
                        }
                    },
                )
            }
        }
        if (orders.isNotEmpty()) {
            OutlinedButton(onClick = onOpenOrders, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(12.dp)) {
                Text("Открыть заявки и назначить мастера")
            }
        }
    }
}

@Composable
private fun ScheduleOrderCard(
    order: ScheduledRepairOrder,
    token: String,
    busy: Boolean,
    runAction: RunAction,
    onOrderUpdated: (RepairOrder) -> Unit,
) {
    val dateTime = order.preferredAt?.let(::localDateTime)
    Card(
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(13.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Row(Modifier.fillMaxWidth()) {
                Text(dateTime?.format(DateTimeFormatter.ofPattern("HH:mm")) ?: "—", fontWeight = FontWeight.Bold, color = UtpBlue)
                Text(" · ${order.serviceNumber}", Modifier.weight(1f), fontSize = 12.sp, color = UtpMuted)
                Text(order.status.statusLabel(), fontSize = 10.sp, color = UtpMuted)
            }
            Text(
                listOfNotNull(order.deviceBrand, order.deviceModel).filter { it.isNotBlank() }
                    .joinToString(" · ").ifBlank { order.deviceType.deviceLabel() },
                fontWeight = FontWeight.SemiBold,
                color = UtpInk,
            )
            Text(order.problem, fontSize = 12.sp, color = UtpMuted)
            Text(
                "${order.customerName} · ${order.technicianName?.shortTechnicianName() ?: "Мастер не назначен"}",
                fontSize = 11.sp,
                color = UtpMuted,
            )
            Text(listOfNotNull(order.city, order.street, order.house).joinToString(", "), fontSize = 11.sp, color = UtpMuted)
            if (order.priority == "URGENT") Text("Срочный приоритет", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = androidx.compose.material3.MaterialTheme.colorScheme.error)
            ScheduleDateTimeField(
                label = "Удобное время",
                value = order.preferredAt,
                onChange = { nextTime ->
                    if (!busy) {
                        runAction({ ApiClient.updatePreferredVisitTime(token, order.id, nextTime) }) { result ->
                            (result as? RepairOrder)?.let(onOrderUpdated)
                        }
                    }
                },
            )
        }
    }
}

private fun localDateTime(value: String) =
    OffsetDateTime.parse(value).atZoneSameInstant(ZoneId.systemDefault())
