package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import ru.utp.servise.data.MonthlySalaryReport
import ru.utp.servise.data.MonthlySalaryReportAdjustment
import ru.utp.servise.data.MonthlySalaryReportSettlement
import java.text.NumberFormat
import java.util.Locale

@Composable
internal fun MonthlySalaryReportCard(
    report: MonthlySalaryReport,
    selected: Boolean,
    onSelect: () -> Unit,
    onDownload: () -> Unit,
    downloading: Boolean,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
            Text(formatSalaryReportPeriod(report.periodStart, report.periodEnd), fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text("${report.technicianCount} мастеров · ${report.workCount} работ", fontSize = 12.sp, color = UtpMuted)
            SalaryReportAmountRow("Начислено", report.totalSalaryRub)
            SalaryReportAmountRow("Налог · авансы · удержания", report.taxRub + report.advanceRub + report.deductionRub)
            SalaryReportAmountRow("К выплате", report.netPayRub, emphasized = true)
            Text(monthlyReportDeliveryLabel(report), fontSize = 11.sp, color = UtpMuted)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = onSelect, modifier = Modifier.weight(1f)) {
                    Text(if (selected) "Скрыть учёт" else "Учёт выплат")
                }
                OutlinedButton(
                    onClick = onDownload,
                    enabled = !downloading,
                    modifier = Modifier.weight(1f),
                ) {
                    Text(if (downloading) "Готовим…" else "Скачать XLSX")
                }
            }
        }
    }
}

@Composable
internal fun MonthlySalarySettlementCard(settlement: MonthlySalaryReportSettlement) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
            Text(settlement.technicianName, fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text("Работ: ${settlement.workCount}", fontSize = 12.sp, color = UtpMuted)
            SalaryReportAmountRow("Начислено", settlement.salaryRub)
            SalaryReportAmountRow("Налог", settlement.taxRub)
            SalaryReportAmountRow("Авансы", settlement.advanceRub)
            SalaryReportAmountRow("Удержания", settlement.deductionRub)
            SalaryReportAmountRow("К выплате", settlement.netPayRub, emphasized = true)
        }
    }
}

@Composable
internal fun MonthlySalaryAdjustmentCard(
    adjustment: MonthlySalaryReportAdjustment,
    canVoid: Boolean,
    onVoid: () -> Unit,
) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(15.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(13.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(payrollAdjustmentLabel(adjustment.type), fontWeight = FontWeight.SemiBold, color = UtpInk)
                Text("${formatSalaryRubles(adjustment.amountRub)} ₽", fontWeight = FontWeight.SemiBold, color = UtpInk)
            }
            Text("${formatSalaryReportDate(adjustment.occurredAt)} · ${adjustment.technicianName}", fontSize = 12.sp, color = UtpMuted)
            Text(adjustment.description, fontSize = 13.sp, color = UtpInk)
            Text("Добавил: ${adjustment.createdByName}", fontSize = 11.sp, color = UtpMuted)
            if (adjustment.isVoided) {
                Text(
                    "Отменено${adjustment.voidedByName?.let { " · $it" }.orEmpty()}: ${adjustment.voidReason.orEmpty()}",
                    fontSize = 11.sp,
                    color = UtpMuted,
                )
            } else if (canVoid) {
                TextButton(onClick = onVoid) { Text("Отменить запись") }
            }
        }
    }
}

@Composable
internal fun SalaryReportAmountRow(label: String, amountRub: Int, emphasized: Boolean = false) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontSize = 12.sp, color = if (emphasized) UtpInk else UtpMuted)
        Text(
            "${formatSalaryRubles(amountRub)} ₽",
            fontSize = 12.sp,
            fontWeight = if (emphasized) FontWeight.Bold else FontWeight.Medium,
            color = if (emphasized) UtpBlue else UtpInk,
        )
    }
}

internal fun formatSalaryRubles(amount: Int): String =
    NumberFormat.getIntegerInstance(Locale.forLanguageTag("ru-RU")).format(amount)

internal fun formatSalaryReportPeriod(start: String, end: String): String =
    "${formatSalaryReportDate(start)} — ${formatSalaryReportDate(end)}"

private fun formatSalaryReportDate(value: String): String {
    val parts = value.take(10).split('-')
    return if (parts.size == 3) "${parts[2]}.${parts[1]}.${parts[0]}" else value
}

private fun monthlyReportDeliveryLabel(report: MonthlySalaryReport): String {
    val counts = report.deliveryCounts
    val total = counts.values.sum()
    return when {
        total == 0 -> "Файл сохранён в архиве. Получатель в MAX не подключён."
        counts["SENT"] == total -> "Отчёт отправлен в MAX администраторам."
        (counts["UNKNOWN"] ?: 0) > 0 -> "Файл сохранён; доставка в MAX не подтверждена."
        (counts["FAILED"] ?: 0) > 0 -> "Файл сохранён; отправка в MAX не удалась."
        else -> "Файл сохранён; отправка в MAX ожидает обработки."
    }
}

private fun payrollAdjustmentLabel(type: String): String = when (type) {
    "TAX" -> "Налог"
    "ADVANCE" -> "Аванс"
    "DEDUCTION" -> "Удержание"
    else -> type
}
