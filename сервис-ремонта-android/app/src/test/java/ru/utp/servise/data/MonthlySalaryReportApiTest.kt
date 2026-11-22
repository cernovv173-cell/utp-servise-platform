package ru.utp.servise.data

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MonthlySalaryReportApiTest {
    @Test
    fun `monthly report mapper reads separate settlement totals and delivery state`() {
        val report = JSONObject()
            .put("id", "report-id")
            .put("periodStart", "2026-11-01T00:00:00.000Z")
            .put("periodEnd", "2026-11-30T00:00:00.000Z")
            .put("fileName", "master-work-2026-11.xlsx")
            .put("workCount", 4)
            .put("technicianCount", 2)
            .put("totalSalaryRub", 120_000)
            .put("taxRub", 8_000)
            .put("advanceRub", 20_000)
            .put("deductionRub", 2_000)
            .put("netPayRub", 90_000)
            .put("generatedAt", "2026-12-01T07:00:00.000Z")
            .put("deliveryCounts", JSONObject().put("SENT", 1).put("FAILED", 0))
            .toMonthlySalaryReport()

        assertEquals("2026-11-01", report.periodStart)
        assertEquals("2026-11-30", report.periodEnd)
        assertEquals(8_000, report.taxRub)
        assertEquals(20_000, report.advanceRub)
        assertEquals(2_000, report.deductionRub)
        assertEquals(90_000, report.netPayRub)
        assertEquals(1, report.deliveryCounts["SENT"])
    }

    @Test
    fun `adjustment mapper preserves cancellation audit and active state`() {
        val active = JSONObject()
            .put("id", "active-id")
            .put("technicianName", "Мастер")
            .put("type", "TAX")
            .put("amountRub", 3_000)
            .put("description", "Налог")
            .put("occurredAt", "2026-11-10T00:00:00.000Z")
            .put("createdByName", "Администратор")
            .toMonthlySalaryReportAdjustment()
        val voided = JSONObject()
            .put("id", "voided-id")
            .put("technicianName", "Мастер")
            .put("type", "ADVANCE")
            .put("amountRub", 5_000)
            .put("description", "Аванс")
            .put("occurredAt", "2026-11-15T00:00:00.000Z")
            .put("createdByName", "Администратор")
            .put("voidedAt", "2026-11-20T12:00:00.000Z")
            .put("voidedByName", "Администратор")
            .put("voidReason", "Запись ошибочная")
            .toMonthlySalaryReportAdjustment()

        assertFalse(active.isVoided)
        assertTrue(voided.isVoided)
        assertEquals("2026-11-15", voided.occurredAt)
        assertEquals("Запись ошибочная", voided.voidReason)
    }
}
