package ru.utp.servise.data

import org.json.JSONObject
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL

object MonthlySalaryReportApi {
    private const val XLSX_CONTENT_TYPE =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

    fun reports(token: String): List<MonthlySalaryReport> =
        ApiClient.request("GET", "/admin/salary-reports", token)
            .optJSONArray("reports")
            .mapObjects { it.toMonthlySalaryReport() }

    fun adjustments(token: String, reportId: String): MonthlySalaryReportAdjustments {
        val json = ApiClient.request(
            "GET",
            "/admin/salary-reports/${reportId.pathSegment()}/adjustments",
            token,
        )
        val totals = json.optJSONObject("totals") ?: JSONObject()
        return MonthlySalaryReportAdjustments(
            settlements = json.optJSONArray("settlements")
                .mapObjects { it.toMonthlySalaryReportSettlement() },
            salaryRub = totals.optInt("salaryRub"),
            taxRub = totals.optInt("taxRub"),
            advanceRub = totals.optInt("advanceRub"),
            deductionRub = totals.optInt("deductionRub"),
            netPayRub = totals.optInt("netPayRub"),
            adjustments = json.optJSONArray("adjustments")
                .mapObjects { it.toMonthlySalaryReportAdjustment() },
        )
    }

    fun createAdjustment(
        token: String,
        reportId: String,
        technicianId: String,
        type: PayrollAdjustmentType,
        amountRub: Int,
        description: String,
        occurredAt: String,
    ): Boolean {
        val result = ApiClient.request(
            "POST",
            "/admin/salary-reports/${reportId.pathSegment()}/adjustments",
            token,
            JSONObject()
                .put("technicianId", technicianId)
                .put("type", type.apiValue)
                .put("amountRub", amountRub)
                .put("description", description.trim())
                .put("occurredAt", occurredAt),
        )
        return result.optBoolean("workbookCurrent")
    }

    fun voidAdjustment(
        token: String,
        reportId: String,
        adjustmentId: String,
        reason: String,
    ): Boolean {
        val result = ApiClient.request(
            "POST",
            "/admin/salary-reports/${reportId.pathSegment()}/adjustments/" +
                "${adjustmentId.pathSegment()}/void",
            token,
            JSONObject().put("reason", reason.trim()),
        )
        return result.optBoolean("workbookCurrent")
    }

    fun downloadXlsx(token: String, reportId: String): ByteArray {
        if (ApiClient.baseUrl.isBlank() || !ApiClient.baseUrl.startsWith("https://")) {
            throw ApiException("API_NOT_CONFIGURED", "Сервер не настроен для этой сборки.")
        }
        val connection = URL(
            "${ApiClient.baseUrl}/api/admin/salary-reports/" +
                "${reportId.pathSegment()}/file",
        ).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = "GET"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.setRequestProperty("Accept", XLSX_CONTENT_TYPE)
            connection.setRequestProperty("Authorization", "Bearer $token")
            val status = connection.responseCode
            if (status !in 200..299) {
                val errorText = connection.errorStream
                    ?.bufferedReader(Charsets.UTF_8)
                    ?.use { it.readText() }
                    .orEmpty()
                val error = runCatching {
                    JSONObject(errorText).optJSONObject("error")
                }.getOrNull()
                throw ApiException(
                    error?.optString("code").orEmpty(),
                    error?.optString("message")
                        .takeUnless { it.isNullOrBlank() }
                        ?: "Не удалось скачать Excel-отчёт.",
                )
            }
            val contentType = connection.contentType?.substringBefore(';')?.trim()
            if (contentType != XLSX_CONTENT_TYPE) {
                throw ApiException(
                    "MONTHLY_SALARY_REPORT_INVALID_FILE",
                    "Сервер вернул файл неподдерживаемого формата.",
                )
            }
            val bytes = connection.inputStream.use { it.readBytes() }
            if (bytes.size < 4 || bytes[0] != 'P'.code.toByte() || bytes[1] != 'K'.code.toByte()) {
                throw ApiException(
                    "MONTHLY_SALARY_REPORT_INVALID_FILE",
                    "Файл отчёта не похож на книгу Excel.",
                )
            }
            return bytes
        } catch (failure: ApiException) {
            throw failure
        } catch (failure: java.net.SocketTimeoutException) {
            throw ApiException("TIMEOUT", failure.message.orEmpty(), failure)
        } catch (failure: IOException) {
            throw ApiException("NETWORK_ERROR", failure.message.orEmpty(), failure)
        } finally {
            connection.disconnect()
        }
    }
}

internal fun JSONObject.toMonthlySalaryReport() = MonthlySalaryReport(
    id = getString("id"),
    periodStart = getString("periodStart").take(10),
    periodEnd = getString("periodEnd").take(10),
    fileName = getString("fileName"),
    workCount = optInt("workCount"),
    technicianCount = optInt("technicianCount"),
    totalSalaryRub = optInt("totalSalaryRub"),
    taxRub = optInt("taxRub"),
    advanceRub = optInt("advanceRub"),
    deductionRub = optInt("deductionRub"),
    netPayRub = optInt("netPayRub"),
    generatedAt = optString("generatedAt"),
    deliveryCounts = optJSONObject("deliveryCounts").let { counts ->
        if (counts == null) emptyMap() else counts.keys().asSequence().associateWith { key ->
            counts.optInt(key)
        }
    },
)

private fun JSONObject.toMonthlySalaryReportSettlement() = MonthlySalaryReportSettlement(
    technicianId = nullableString("technicianId"),
    technicianName = optString("technicianName"),
    workCount = optInt("workCount"),
    serviceTotalRub = optInt("serviceTotalRub"),
    visitFeesRub = optInt("visitFeesRub"),
    salaryRub = optInt("salaryRub"),
    taxRub = optInt("taxRub"),
    advanceRub = optInt("advanceRub"),
    deductionRub = optInt("deductionRub"),
    netPayRub = optInt("netPayRub"),
)

internal fun JSONObject.toMonthlySalaryReportAdjustment() = MonthlySalaryReportAdjustment(
    id = getString("id"),
    technicianId = nullableString("technicianId"),
    technicianName = optString("technicianName"),
    type = optString("type"),
    amountRub = optInt("amountRub"),
    description = optString("description"),
    occurredAt = optString("occurredAt").take(10),
    createdByName = optString("createdByName"),
    voidedAt = nullableString("voidedAt"),
    voidedByName = nullableString("voidedByName"),
    voidReason = nullableString("voidReason"),
)

private fun String.pathSegment(): String = java.net.URLEncoder.encode(this, Charsets.UTF_8.name())
