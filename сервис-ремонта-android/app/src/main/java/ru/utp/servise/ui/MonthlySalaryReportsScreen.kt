package ru.utp.servise.ui

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import ru.utp.servise.data.MonthlySalaryReport
import ru.utp.servise.data.MonthlySalaryReportAdjustment
import ru.utp.servise.data.MonthlySalaryReportAdjustments
import ru.utp.servise.data.MonthlySalaryReportApi
import ru.utp.servise.data.PayrollAdjustmentType

private const val XLSX_MIME_TYPE =
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

@Composable
internal fun MonthlySalaryReportsScreen(
    token: String,
    onError: (String) -> Unit,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var reports by remember { mutableStateOf(emptyList<MonthlySalaryReport>()) }
    var archiveLoading by remember { mutableStateOf(true) }
    var archiveError by remember { mutableStateOf(false) }
    var selectedReportId by remember { mutableStateOf<String?>(null) }
    var adjustments by remember { mutableStateOf<MonthlySalaryReportAdjustments?>(null) }
    var detailLoading by remember { mutableStateOf(false) }
    var detailError by remember { mutableStateOf(false) }
    var savingAdjustment by remember { mutableStateOf(false) }
    var voidingAdjustment by remember { mutableStateOf(false) }
    var voidTarget by remember { mutableStateOf<MonthlySalaryReportAdjustment?>(null) }
    var downloadInProgressId by remember { mutableStateOf<String?>(null) }
    var pendingDownload by remember { mutableStateOf<Pair<String, ByteArray>?>(null) }
    var successfulSubmissions by remember { mutableStateOf(0) }

    val documentLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument(XLSX_MIME_TYPE),
    ) { uri ->
        val file = pendingDownload
        pendingDownload = null
        if (uri != null && file != null) {
            scope.launch {
                runCatching {
                    withContext(Dispatchers.IO) {
                        context.contentResolver.openOutputStream(uri)?.use { output ->
                            output.write(file.second)
                        } ?: error("Не удалось открыть файл для сохранения.")
                    }
                }.onSuccess {
                    Toast.makeText(context, "Excel-отчёт сохранён.", Toast.LENGTH_SHORT).show()
                }.onFailure { failure ->
                    onError(failure.message ?: "Не удалось сохранить Excel-отчёт.")
                }
            }
        }
    }

    fun loadArchive() {
        scope.launch {
            archiveLoading = true
            archiveError = false
            runCatching { withContext(Dispatchers.IO) { MonthlySalaryReportApi.reports(token) } }
                .onSuccess { reports = it }
                .onFailure { failure ->
                    archiveError = true
                    onError(failure.message ?: "Не удалось загрузить архив отчётов.")
                }
            archiveLoading = false
        }
    }

    fun loadAdjustments(report: MonthlySalaryReport) {
        scope.launch {
            selectedReportId = report.id
            adjustments = null
            detailLoading = true
            detailError = false
            runCatching {
                withContext(Dispatchers.IO) {
                    MonthlySalaryReportApi.adjustments(token, report.id)
                }
            }.onSuccess { adjustments = it }
                .onFailure { failure ->
                    detailError = true
                    onError(failure.message ?: "Не удалось загрузить расчёт за месяц.")
                }
            detailLoading = false
        }
    }

    LaunchedEffect(token) { loadArchive() }

    val selectedReport = reports.firstOrNull { it.id == selectedReportId }

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(UtpPale),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        item {
            TextButton(onClick = onBack) { Text("←  Управление") }
            Text("Отчёты по зарплате", fontSize = 25.sp, fontWeight = FontWeight.Bold, color = UtpInk)
            Text(
                "Ежемесячный Excel по работам и начислениям каждого мастера. Налог вносится вручную; система не рассчитывает налоговую ставку.",
                modifier = Modifier.padding(top = 5.dp),
                fontSize = 12.sp,
                color = UtpMuted,
                lineHeight = 18.sp,
            )
            TextButton(onClick = ::loadArchive, enabled = !archiveLoading) {
                Text(if (archiveLoading) "Загрузка…" else "Обновить архив")
            }
        }
        if (archiveLoading && reports.isEmpty()) {
            item { Text("Загружаем архив…", color = UtpMuted) }
        } else if (archiveError && reports.isEmpty()) {
            item {
                Text("Архив не загрузился. Нажмите «Обновить архив» и попробуйте ещё раз.", color = UtpMuted)
            }
        } else if (reports.isEmpty()) {
            item {
                Text("Отчётов пока нет. После окончания месяца Excel появится здесь.", color = UtpMuted)
            }
        }
        items(reports, key = { it.id }) { report ->
            MonthlySalaryReportCard(
                report = report,
                selected = report.id == selectedReportId,
                onSelect = {
                    if (report.id == selectedReportId) {
                        selectedReportId = null
                        adjustments = null
                    } else {
                        loadAdjustments(report)
                    }
                },
                downloading = downloadInProgressId == report.id,
                onDownload = {
                    scope.launch {
                        downloadInProgressId = report.id
                        runCatching {
                            withContext(Dispatchers.IO) {
                                MonthlySalaryReportApi.downloadXlsx(token, report.id)
                            }
                        }.onSuccess { bytes ->
                            pendingDownload = report.fileName to bytes
                            documentLauncher.launch(report.fileName)
                        }.onFailure { failure ->
                            onError(failure.message ?: "Не удалось скачать Excel-отчёт.")
                        }
                        downloadInProgressId = null
                    }
                },
            )
        }
        if (selectedReport != null) {
            item {
                Text(
                    "Расчёт за ${formatSalaryReportPeriod(selectedReport.periodStart, selectedReport.periodEnd)}",
                    modifier = Modifier.padding(top = 5.dp),
                    fontSize = 18.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = UtpInk,
                )
            }
            if (detailLoading) {
                item { Text("Загружаем начисления…", color = UtpMuted) }
            } else if (detailError) {
                item {
                    TextButton(onClick = { loadAdjustments(selectedReport) }) {
                        Text("Не удалось загрузить расчёт · Повторить")
                    }
                }
            } else if (adjustments != null) {
                val totals = adjustments!!
                item {
                    Card(
                        modifier = Modifier.fillMaxWidth(),
                        shape = androidx.compose.foundation.shape.RoundedCornerShape(18.dp),
                        colors = CardDefaults.cardColors(
                            containerColor = androidx.compose.material3.MaterialTheme.colorScheme.surface,
                        ),
                    ) {
                        Column(
                            Modifier.fillMaxWidth().padding(14.dp),
                            verticalArrangement = Arrangement.spacedBy(5.dp),
                        ) {
                            SalaryReportAmountRow("Начислено", totals.salaryRub, emphasized = true)
                            SalaryReportAmountRow("Налог", totals.taxRub)
                            SalaryReportAmountRow("Авансы", totals.advanceRub)
                            SalaryReportAmountRow("Удержания", totals.deductionRub)
                            SalaryReportAmountRow("К выплате", totals.netPayRub, emphasized = true)
                            Text(
                                "К выплате = начислено − налог − авансы − удержания",
                                modifier = Modifier.padding(top = 4.dp),
                                fontSize = 11.sp,
                                color = UtpMuted,
                            )
                        }
                    }
                }
                item {
                    MonthlyPayrollAdjustmentForm(
                        periodStart = selectedReport.periodStart,
                        periodEnd = selectedReport.periodEnd,
                        settlements = totals.settlements,
                        saving = savingAdjustment,
                        resetKey = successfulSubmissions,
                    ) { technicianId, type, amountRub, description, date ->
                        scope.launch {
                            savingAdjustment = true
                            runCatching {
                                withContext(Dispatchers.IO) {
                                    MonthlySalaryReportApi.createAdjustment(
                                        token,
                                        selectedReport.id,
                                        technicianId,
                                        type,
                                        amountRub,
                                        description,
                                        date,
                                    )
                                }
                            }.onSuccess { workbookCurrent ->
                                successfulSubmissions += 1
                                Toast.makeText(
                                    context,
                                    if (workbookCurrent) "Запись добавлена, Excel обновлён."
                                    else "Запись добавлена, Excel обновляется.",
                                    Toast.LENGTH_LONG,
                                ).show()
                                loadArchive()
                                runCatching {
                                    withContext(Dispatchers.IO) {
                                        MonthlySalaryReportApi.adjustments(token, selectedReport.id)
                                    }
                                }.onSuccess { adjustments = it }
                                    .onFailure { failure -> onError(failure.message ?: "Не удалось обновить расчёт.") }
                            }.onFailure { failure ->
                                onError(failure.message ?: "Не удалось добавить запись.")
                            }
                            savingAdjustment = false
                        }
                    }
                }
                if (totals.settlements.isNotEmpty()) {
                    item {
                        Text("По мастерам", fontWeight = FontWeight.SemiBold, color = UtpInk)
                    }
                    items(
                        totals.settlements,
                        key = { "${it.technicianId ?: "unknown"}-${it.technicianName}" },
                    ) { settlement -> MonthlySalarySettlementCard(settlement) }
                }
                item {
                    Text("История записей", fontWeight = FontWeight.SemiBold, color = UtpInk)
                }
                if (totals.adjustments.isEmpty()) {
                    item { Text("Налог, авансы и удержания ещё не добавлены.", color = UtpMuted, fontSize = 12.sp) }
                }
                items(totals.adjustments, key = { it.id }) { adjustment ->
                    MonthlySalaryAdjustmentCard(
                        adjustment = adjustment,
                        canVoid = !adjustment.isVoided,
                        onVoid = { voidTarget = adjustment },
                    )
                }
            }
        }
    }

    voidTarget?.let { adjustment ->
        VoidPayrollAdjustmentDialog(
            onDismiss = { if (!voidingAdjustment) voidTarget = null },
            onConfirm = { reason ->
                scope.launch {
                    voidingAdjustment = true
                    runCatching {
                        withContext(Dispatchers.IO) {
                            MonthlySalaryReportApi.voidAdjustment(
                                token,
                                selectedReport?.id.orEmpty(),
                                adjustment.id,
                                reason,
                            )
                        }
                    }.onSuccess { workbookCurrent ->
                        voidTarget = null
                        Toast.makeText(
                            context,
                            if (workbookCurrent) "Запись отменена, Excel пересчитан."
                            else "Запись отменена, Excel обновляется.",
                            Toast.LENGTH_LONG,
                        ).show()
                        loadArchive()
                        selectedReport?.let { report ->
                            runCatching {
                                withContext(Dispatchers.IO) {
                                    MonthlySalaryReportApi.adjustments(token, report.id)
                                }
                            }.onSuccess { adjustments = it }
                                .onFailure { failure -> onError(failure.message ?: "Не удалось обновить расчёт.") }
                        }
                    }.onFailure { failure ->
                        onError(failure.message ?: "Не удалось отменить запись.")
                    }
                    voidingAdjustment = false
                }
            },
            saving = voidingAdjustment,
        )
    }
}
