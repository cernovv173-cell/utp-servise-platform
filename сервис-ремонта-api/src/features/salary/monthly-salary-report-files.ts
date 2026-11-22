import type { DatabaseClient } from "../../lib/database/database.js";
import { createLogger } from "../../lib/logger.js";
import {
  deleteProjectFile,
  uploadProjectFile,
} from "../../lib/storage/project-images.js";
import { type MonthlySalaryReportAdjustment } from "./monthly-salary-report-adjustments.js";
import {
  MONTHLY_SALARY_REPORT_CONTENT_TYPE,
  buildMonthlySalaryWorkbook,
  loadMonthlySalaryReportData,
} from "./monthly-salary-report-workbook.js";
import {
  getCalendarDateParts,
  getSalaryMonthRangeForCalendarMonth,
} from "./salary-periods.js";

const logger = createLogger();

export const loadMonthlySalaryReportAdjustments = async (
  database: DatabaseClient,
  reportId: string,
): Promise<MonthlySalaryReportAdjustment[]> =>
  database.technicianPayrollAdjustment.findMany({
    where: { reportId },
    select: {
      id: true,
      technicianId: true,
      technicianName: true,
      type: true,
      amountRub: true,
      description: true,
      occurredAt: true,
      createdByName: true,
      voidedAt: true,
      voidedByName: true,
      voidReason: true,
    },
    orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
  });

const monthLabel = (date: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(date);

export const refreshMonthlySalaryReportWorkbook = async (
  database: DatabaseClient,
  reportId: string,
  generatedAt = new Date(),
): Promise<boolean> => {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const report = await database.technicianMonthlySalaryReport.findUnique({
      where: { id: reportId },
      select: {
        id: true,
        periodStart: true,
        fileObjectId: true,
        fileName: true,
        adjustmentVersion: true,
        fileAdjustmentVersion: true,
      },
    });
    if (!report) return false;
    if (report.fileAdjustmentVersion >= report.adjustmentVersion) return true;

    const month = getCalendarDateParts(report.periodStart, "UTC");
    const range = getSalaryMonthRangeForCalendarMonth(
      month.year,
      month.month,
      "Europe/Moscow",
    );
    const [data, adjustments] = await Promise.all([
      loadMonthlySalaryReportData(database, range),
      loadMonthlySalaryReportAdjustments(database, report.id),
    ]);
    const bytes = await buildMonthlySalaryWorkbook({
      data,
      adjustments,
      periodLabel: monthLabel(report.periodStart),
      generatedAt,
    });
    const fileObjectId = await uploadProjectFile(
      bytes,
      MONTHLY_SALARY_REPORT_CONTENT_TYPE,
      report.fileName,
    );

    try {
      const updated = await database.$transaction(async (transaction) => {
        const replaced =
          await transaction.technicianMonthlySalaryReport.updateMany({
            where: {
              id: report.id,
              fileObjectId: report.fileObjectId,
              adjustmentVersion: report.adjustmentVersion,
            },
            data: {
              fileObjectId,
              fileAdjustmentVersion: report.adjustmentVersion,
              generatedAt,
              updatedAt: generatedAt,
            },
          });
        if (replaced.count !== 1) return false;

        await transaction.technicianMonthlySalaryReportDelivery.updateMany({
          where: {
            reportId: report.id,
            status: {
              in: ["PENDING", "PROCESSING", "SENDING", "SENT", "FAILED"],
            },
          },
          data: {
            status: "PENDING",
            attemptCount: 0,
            nextAttemptAt: generatedAt,
            lockedUntil: null,
            sentAt: null,
            lastError: "Обновлён отчёт; отправляется последняя версия.",
            updatedAt: generatedAt,
          },
        });
        return true;
      });

      if (!updated) {
        await deleteProjectFile(fileObjectId);
        continue;
      }
      await deleteProjectFile(report.fileObjectId).catch(() => {
        logger.warn(
          { reportId: report.id },
          "monthly_salary_report_old_file_cleanup_failed",
        );
      });
      return true;
    } catch (error) {
      await deleteProjectFile(fileObjectId).catch(() => {
        logger.warn(
          { reportId: report.id },
          "monthly_salary_report_new_file_cleanup_failed",
        );
      });
      throw error;
    }
  }
  return false;
};
