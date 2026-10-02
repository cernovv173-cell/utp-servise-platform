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
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.SalaryAmounts
import ru.utp.servise.data.SalaryRange
import ru.utp.servise.data.SalarySummary
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

@Composable
fun SalaryScreen(summary: SalarySummary, isAdmin: Boolean, onRefresh: () -> Unit) {
    Column(
        Modifier.fillMaxSize().background(UtpPale).verticalScroll(rememberScrollState()).padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(if (isAdmin) "Зарплата мастеров" else "Моя зарплата", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
        Text(
            "${summary.ratePercent}% от стоимости услуг в завершённых ремонтах. Запчасти не учитываются.",
            fontSize = 13.sp,
            color = UtpMuted,
        )
        SalaryPeriodCard("Сегодня", summary.totals.day, summary.dayRange, summary.timeZone, isAdmin)
        SalaryPeriodCard("Эта неделя", summary.totals.week, summary.weekRange, summary.timeZone, isAdmin)
        SalaryPeriodCard("Этот месяц", summary.totals.month, summary.monthRange, summary.timeZone, isAdmin)

        if (isAdmin) {
            Text("Начисления по мастерам", fontSize = 18.sp, fontWeight = FontWeight.SemiBold, color = UtpInk, modifier = Modifier.padding(top = 8.dp))
            if (summary.technicians.isEmpty()) {
                Text("Учётных записей мастеров пока нет.", fontSize = 13.sp, color = UtpMuted)
            }
            summary.technicians.forEach { technician ->
                Card(
                    shape = RoundedCornerShape(16.dp),
                    colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
                ) {
                    Column(Modifier.fillMaxWidth().padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(technician.displayName, fontWeight = FontWeight.SemiBold, color = UtpInk)
                        SalaryAmountRow(technician.amounts)
                    }
                }
            }
        } else {
            Text(
                "Начисление фиксируется по дате завершения ремонта. Это расчёт заработка, а не отметка о фактической выплате.",
                fontSize = 12.sp,
                color = UtpMuted,
                lineHeight = 18.sp,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
        Button(onClick = onRefresh, modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
            Text("Обновить расчёт")
        }
    }
}

@Composable
private fun SalaryPeriodCard(
    title: String,
    amountRub: Int,
    range: SalaryRange,
    timeZone: String,
    isAdmin: Boolean,
) {
    Card(
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface),
    ) {
        Column(Modifier.fillMaxWidth().padding(16.dp)) {
            Text(if (isAdmin) "Все мастера · $title" else title, fontSize = 13.sp, color = UtpMuted)
            Text("${formatRubles(amountRub)} ₽", fontSize = 26.sp, fontWeight = FontWeight.Bold, color = UtpBlue, modifier = Modifier.padding(top = 4.dp))
            Text(formatRange(range, timeZone), fontSize = 11.sp, color = UtpMuted, modifier = Modifier.padding(top = 3.dp))
        }
    }
}

@Composable
private fun SalaryAmountRow(amounts: SalaryAmounts) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SalaryAmountCell("День", amounts.day, Modifier.weight(1f))
        SalaryAmountCell("Неделя", amounts.week, Modifier.weight(1f))
        SalaryAmountCell("Месяц", amounts.month, Modifier.weight(1f))
    }
}

@Composable
private fun SalaryAmountCell(label: String, amount: Int, modifier: Modifier) {
    Column(modifier) {
        Text(label, fontSize = 11.sp, color = UtpMuted)
        Text("${formatRubles(amount)} ₽", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = UtpInk)
    }
}

private fun formatRange(range: SalaryRange, timeZone: String): String {
    if (range.startsAt.isBlank() || range.endsAt.isBlank()) return ""
    return runCatching {
        val zone = ZoneId.of(timeZone)
        val formatter = DateTimeFormatter.ofPattern("d MMM", Locale.forLanguageTag("ru-RU"))
        val first = Instant.parse(range.startsAt).atZone(zone).toLocalDate()
        val last = Instant.parse(range.endsAt).minusNanos(1).atZone(zone).toLocalDate()
        if (first == last) first.format(formatter) else "${first.format(formatter)} — ${last.format(formatter)}"
    }.getOrDefault("")
}

private fun formatRubles(amount: Int): String =
    NumberFormat.getIntegerInstance(Locale.forLanguageTag("ru-RU")).format(amount)
