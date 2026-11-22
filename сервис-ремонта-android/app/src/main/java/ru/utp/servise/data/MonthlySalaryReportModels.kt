package ru.utp.servise.data

data class MonthlySalaryReport(
    val id: String,
    val periodStart: String,
    val periodEnd: String,
    val fileName: String,
    val workCount: Int,
    val technicianCount: Int,
    val totalSalaryRub: Int,
    val taxRub: Int,
    val advanceRub: Int,
    val deductionRub: Int,
    val netPayRub: Int,
    val generatedAt: String,
    val deliveryCounts: Map<String, Int>,
)

data class MonthlySalaryReportSettlement(
    val technicianId: String?,
    val technicianName: String,
    val workCount: Int,
    val serviceTotalRub: Int,
    val visitFeesRub: Int,
    val salaryRub: Int,
    val taxRub: Int,
    val advanceRub: Int,
    val deductionRub: Int,
    val netPayRub: Int,
)

data class MonthlySalaryReportAdjustment(
    val id: String,
    val technicianId: String?,
    val technicianName: String,
    val type: String,
    val amountRub: Int,
    val description: String,
    val occurredAt: String,
    val createdByName: String,
    val voidedAt: String?,
    val voidedByName: String?,
    val voidReason: String?,
) {
    val isVoided: Boolean get() = voidedAt != null
}

data class MonthlySalaryReportAdjustments(
    val settlements: List<MonthlySalaryReportSettlement>,
    val salaryRub: Int,
    val taxRub: Int,
    val advanceRub: Int,
    val deductionRub: Int,
    val netPayRub: Int,
    val adjustments: List<MonthlySalaryReportAdjustment>,
)

enum class PayrollAdjustmentType(val apiValue: String, val label: String) {
    TAX("TAX", "Налог"),
    ADVANCE("ADVANCE", "Аванс"),
    DEDUCTION("DEDUCTION", "Удержание"),
}
