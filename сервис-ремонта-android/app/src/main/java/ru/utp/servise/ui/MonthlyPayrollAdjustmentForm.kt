package ru.utp.servise.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
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
import ru.utp.servise.data.MonthlySalaryReportSettlement
import ru.utp.servise.data.PayrollAdjustmentType

@Composable
internal fun MonthlyPayrollAdjustmentForm(
    periodStart: String,
    periodEnd: String,
    settlements: List<MonthlySalaryReportSettlement>,
    saving: Boolean,
    resetKey: Int,
    onSave: (technicianId: String, type: PayrollAdjustmentType, amountRub: Int, description: String, date: String) -> Unit,
) {
    val technicians = settlements.filter { it.technicianId != null }
    var selectedTechnicianId by remember(resetKey, periodStart, settlements) {
        mutableStateOf(technicians.firstOrNull()?.technicianId.orEmpty())
    }
    var selectedType by remember(resetKey) { mutableStateOf(PayrollAdjustmentType.TAX) }
    var date by remember(resetKey, periodEnd) { mutableStateOf(periodEnd) }
    var amount by remember(resetKey) { mutableStateOf("") }
    var description by remember(resetKey) { mutableStateOf("") }
    var technicianMenuExpanded by remember { mutableStateOf(false) }
    val selectedTechnician = technicians.firstOrNull { it.technicianId == selectedTechnicianId }

    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(
            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
        ),
    ) {
        Column(
            Modifier.fillMaxWidth().padding(15.dp),
            verticalArrangement = Arrangement.spacedBy(9.dp),
        ) {
            Text("Добавить запись", fontWeight = FontWeight.SemiBold, color = UtpInk)
            Text("Дата должна попадать в выбранный месяц. Налог вводится вручную.", color = UtpMuted, fontSize = 12.sp)
            Box {
                OutlinedButton(
                    onClick = { technicianMenuExpanded = true },
                    enabled = technicians.isNotEmpty() && !saving,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(selectedTechnician?.technicianName ?: "Выберите мастера")
                }
                DropdownMenu(
                    expanded = technicianMenuExpanded,
                    onDismissRequest = { technicianMenuExpanded = false },
                ) {
                    technicians.forEach { technician ->
                        DropdownMenuItem(
                            text = { Text(technician.technicianName) },
                            onClick = {
                                selectedTechnicianId = technician.technicianId.orEmpty()
                                technicianMenuExpanded = false
                            },
                        )
                    }
                }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                PayrollAdjustmentType.values().forEach { type ->
                    FilterChip(
                        selected = selectedType == type,
                        onClick = { selectedType = type },
                        label = { Text(type.label) },
                        enabled = !saving,
                    )
                }
            }
            OutlinedTextField(
                value = date,
                onValueChange = { date = it.take(10) },
                label = { Text("Дата · ГГГГ-ММ-ДД") },
                placeholder = { Text("2026-11-30") },
                singleLine = true,
                enabled = !saving,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = amount,
                onValueChange = { amount = it.filter(Char::isDigit).take(8) },
                label = { Text("Сумма, ₽") },
                singleLine = true,
                enabled = !saving,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = description,
                onValueChange = { description = it.take(250) },
                label = { Text("Основание") },
                placeholder = { Text("Например, аванс от 15 числа") },
                enabled = !saving,
                modifier = Modifier.fillMaxWidth(),
            )
            Button(
                onClick = {
                    val amountRub = amount.toIntOrNull()
                    val isDateValid = runCatching {
                        val parsedDate = java.time.LocalDate.parse(date)
                        !parsedDate.isBefore(java.time.LocalDate.parse(periodStart)) &&
                            !parsedDate.isAfter(java.time.LocalDate.parse(periodEnd))
                    }.getOrDefault(false)
                    if (
                        selectedTechnicianId.isNotBlank() &&
                        amountRub != null && amountRub in 1..50_000_000 &&
                        description.isNotBlank() && isDateValid
                    ) {
                        onSave(selectedTechnicianId, selectedType, amountRub, description.trim(), date)
                    }
                },
                enabled = !saving && selectedTechnician != null &&
                    amount.toIntOrNull()?.let { it in 1..50_000_000 } == true && description.isNotBlank() &&
                    isPayrollAdjustmentDateInPeriod(date, periodStart, periodEnd),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (saving) "Сохраняем…" else "Добавить в расчёт")
            }
            if (technicians.isEmpty()) {
                Text("В отчёте нет мастеров для выбора.", color = UtpMuted, fontSize = 12.sp)
            }
        }
    }
}

@Composable
internal fun VoidPayrollAdjustmentDialog(
    onDismiss: () -> Unit,
    onConfirm: (String) -> Unit,
    saving: Boolean,
) {
    var reason by remember { mutableStateOf("") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Отменить запись?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Запись останется в истории, но перестанет уменьшать сумму к выплате.")
                OutlinedTextField(
                    value = reason,
                    onValueChange = { reason = it.take(250) },
                    label = { Text("Причина отмены") },
                    enabled = !saving,
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        },
        confirmButton = {
            TextButton(
                onClick = { onConfirm(reason.trim()) },
                enabled = !saving && reason.isNotBlank(),
            ) {
                Text(if (saving) "Сохраняем…" else "Подтвердить")
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss, enabled = !saving) { Text("Назад") }
        },
    )
}

private fun isPayrollAdjustmentDateInPeriod(value: String, start: String, end: String): Boolean =
    runCatching {
        val date = java.time.LocalDate.parse(value)
        !date.isBefore(java.time.LocalDate.parse(start)) && !date.isAfter(java.time.LocalDate.parse(end))
    }.getOrDefault(false)
