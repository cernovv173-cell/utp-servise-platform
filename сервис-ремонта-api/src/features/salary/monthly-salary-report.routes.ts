import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { validateRequest } from "../../lib/http/validate-request.js";
import { createLogger } from "../../lib/logger.js";
import { downloadProjectFile } from "../../lib/storage/project-images.js";
import {
  createRequireAuth,
  getAuthenticatedUser,
  requireRoles,
} from "../auth/auth.middleware.js";
import {
  type TechnicianPayrollAdjustmentType,
  summarizeMonthlySalarySettlements,
} from "./monthly-salary-report-adjustments.js";
import { refreshMonthlySalaryReportWorkbook } from "./monthly-salary-report-files.js";
import { loadMonthlySalaryReportAdjustments } from "./monthly-salary-report-files.js";
import { loadMonthlySalaryReportData } from "./monthly-salary-report-workbook.js";
import { MONTHLY_SALARY_REPORT_CONTENT_TYPE } from "./monthly-salary-report-workbook.js";
import { getSalaryMonthRangeForCalendarMonth } from "./salary-periods.js";

const logger = createLogger();
const reportIdSchema = z.string().uuid();
const reportIdParamsSchema = z.object({ reportId: reportIdSchema }).strict();
const adjustmentParamsSchema = z
  .object({ reportId: reportIdSchema, adjustmentId: z.string().uuid() })
  .strict();
const validDateOnly = (value: string): boolean => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
};
const adjustmentBodySchema = z
  .object({
    technicianId: z.string().uuid(),
    type: z.enum(["TAX", "ADVANCE", "DEDUCTION"]),
    amountRub: z.number().int().min(1).max(50_000_000),
    description: z.string().trim().min(1).max(250),
    occurredAt: z.string().refine(validDateOnly),
  })
  .strict();
const voidBodySchema = z
  .object({ reason: z.string().trim().min(1).max(250) })
  .strict();

const bodyOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly body: T }).body;
const paramsOf = <T>(response: { locals: { input?: unknown } }): T =>
  (response.locals.input as { readonly params: T }).params;

const deliveryStatuses = [
  "PENDING",
  "PROCESSING",
  "SENDING",
  "SENT",
  "FAILED",
  "UNKNOWN",
  "SKIPPED",
] as const;

export const createMonthlySalaryReportRouter = (
  database: DatabaseClient,
): Router => {
  const router = Router();
  const requireAuth = createRequireAuth(database);

  router.get(
    "/admin/salary-reports",
    requireAuth,
    requireRoles("ADMIN"),
    async (_request, response) => {
      const reports = await database.technicianMonthlySalaryReport.findMany({
        take: 36,
        orderBy: { periodStart: "desc" },
        select: {
          id: true,
          periodStart: true,
          periodEnd: true,
          fileName: true,
          workCount: true,
          technicianCount: true,
          totalSalaryRub: true,
          generatedAt: true,
          deliveries: { select: { status: true } },
          adjustments: {
            where: { voidedAt: null },
            select: { type: true, amountRub: true },
          },
        },
      });
      response.set("Cache-Control", "private, no-store");
      response.json({
        reports: reports.map((report) => {
          const deliveryCounts = Object.fromEntries(
            deliveryStatuses.map((status) => [
              status,
              report.deliveries.filter((delivery) => delivery.status === status)
                .length,
            ]),
          ) as Record<(typeof deliveryStatuses)[number], number>;
          const adjustmentTotals = report.adjustments.reduce(
            (totals, adjustment) => {
              if (adjustment.type === "TAX") {
                totals.taxRub += adjustment.amountRub;
              } else if (adjustment.type === "ADVANCE") {
                totals.advanceRub += adjustment.amountRub;
              } else {
                totals.deductionRub += adjustment.amountRub;
              }
              return totals;
            },
            { taxRub: 0, advanceRub: 0, deductionRub: 0 },
          );
          return {
            id: report.id,
            periodStart: report.periodStart.toISOString().slice(0, 10),
            periodEnd: report.periodEnd.toISOString().slice(0, 10),
            fileName: report.fileName,
            workCount: report.workCount,
            technicianCount: report.technicianCount,
            totalSalaryRub: report.totalSalaryRub,
            ...adjustmentTotals,
            netPayRub:
              report.totalSalaryRub -
              adjustmentTotals.taxRub -
              adjustmentTotals.advanceRub -
              adjustmentTotals.deductionRub,
            generatedAt: report.generatedAt,
            deliveryCounts,
          };
        }),
      });
    },
  );

  router.get(
    "/admin/salary-reports/:reportId/adjustments",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: reportIdParamsSchema }),
    async (_request, response) => {
      const { reportId } =
        paramsOf<z.infer<typeof reportIdParamsSchema>>(response);
      const report = await database.technicianMonthlySalaryReport.findUnique({
        where: { id: reportId },
        select: { periodStart: true },
      });
      if (!report) {
        throw new HttpError(
          404,
          "MONTHLY_SALARY_REPORT_NOT_FOUND",
          "Отчёт не найден.",
        );
      }
      const month = {
        year: report.periodStart.getUTCFullYear(),
        month: report.periodStart.getUTCMonth() + 1,
      };
      const [data, adjustments] = await Promise.all([
        loadMonthlySalaryReportData(
          database,
          getSalaryMonthRangeForCalendarMonth(
            month.year,
            month.month,
            "Europe/Moscow",
          ),
        ),
        loadMonthlySalaryReportAdjustments(database, reportId),
      ]);
      const { settlements, totals } = summarizeMonthlySalarySettlements(
        data,
        adjustments,
      );
      response.set("Cache-Control", "private, no-store");
      response.json({
        settlements,
        totals: { ...totals, salaryRub: data.totalSalaryRub },
        adjustments: adjustments.map((adjustment) => ({
          ...adjustment,
          occurredAt: adjustment.occurredAt.toISOString().slice(0, 10),
        })),
      });
    },
  );

  router.post(
    "/admin/salary-reports/:reportId/adjustments",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({
      params: reportIdParamsSchema,
      body: adjustmentBodySchema,
    }),
    async (_request, response) => {
      const administrator = getAuthenticatedUser(response);
      const { reportId } =
        paramsOf<z.infer<typeof reportIdParamsSchema>>(response);
      const input = bodyOf<z.infer<typeof adjustmentBodySchema>>(response);
      const [report, technician] = await Promise.all([
        database.technicianMonthlySalaryReport.findUnique({
          where: { id: reportId },
          select: { id: true, periodStart: true, periodEnd: true },
        }),
        database.user.findUnique({
          where: { id: input.technicianId },
          select: { id: true, displayName: true, role: true },
        }),
      ]);
      if (!report) {
        throw new HttpError(
          404,
          "MONTHLY_SALARY_REPORT_NOT_FOUND",
          "Отчёт не найден.",
        );
      }
      if (!technician || technician.role !== "TECHNICIAN") {
        throw new HttpError(404, "TECHNICIAN_NOT_FOUND", "Мастер не найден.");
      }
      const occurredAt = new Date(`${input.occurredAt}T00:00:00.000Z`);
      if (occurredAt < report.periodStart || occurredAt > report.periodEnd) {
        throw new HttpError(
          400,
          "PAYROLL_ADJUSTMENT_DATE_OUTSIDE_REPORT_PERIOD",
          "Дата записи должна находиться внутри отчётного месяца.",
        );
      }
      const now = new Date();
      const adjustment = await database.$transaction(async (transaction) => {
        const created = await transaction.technicianPayrollAdjustment.create({
          data: {
            reportId,
            technicianId: technician.id,
            technicianName: technician.displayName,
            type: input.type as TechnicianPayrollAdjustmentType,
            amountRub: input.amountRub,
            description: input.description,
            occurredAt,
            createdById: administrator.id,
            createdByName: administrator.displayName,
            createdAt: now,
            updatedAt: now,
          },
        });
        await transaction.technicianMonthlySalaryReport.update({
          where: { id: reportId },
          data: { adjustmentVersion: { increment: 1 }, updatedAt: now },
        });
        return created;
      });
      let workbookCurrent = false;
      try {
        workbookCurrent = await refreshMonthlySalaryReportWorkbook(
          database,
          reportId,
        );
      } catch {
        logger.warn(
          { reportId },
          "monthly_salary_report_adjustment_saved_refresh_pending",
        );
      }
      response.set("Cache-Control", "private, no-store");
      response.status(201).json({
        adjustment,
        workbookCurrent,
        type: input.type,
      });
    },
  );

  router.post(
    "/admin/salary-reports/:reportId/adjustments/:adjustmentId/void",
    requireAuth,
    requireRoles("ADMIN"),
    validateRequest({ params: adjustmentParamsSchema, body: voidBodySchema }),
    async (_request, response) => {
      const administrator = getAuthenticatedUser(response);
      const { reportId, adjustmentId } =
        paramsOf<z.infer<typeof adjustmentParamsSchema>>(response);
      const { reason } = bodyOf<z.infer<typeof voidBodySchema>>(response);
      const now = new Date();
      await database.$transaction(async (transaction) => {
        const existing =
          await transaction.technicianPayrollAdjustment.findFirst({
            where: { id: adjustmentId, reportId, voidedAt: null },
            select: { id: true },
          });
        if (!existing) {
          throw new HttpError(
            404,
            "PAYROLL_ADJUSTMENT_NOT_FOUND",
            "Действующая запись не найдена.",
          );
        }
        const updated =
          await transaction.technicianPayrollAdjustment.updateMany({
            where: { id: adjustmentId, reportId, voidedAt: null },
            data: {
              voidedAt: now,
              voidedById: administrator.id,
              voidedByName: administrator.displayName,
              voidReason: reason,
              updatedAt: now,
            },
          });
        if (updated.count !== 1) {
          throw new HttpError(
            409,
            "PAYROLL_ADJUSTMENT_ALREADY_VOIDED",
            "Запись уже отменена.",
          );
        }
        await transaction.technicianMonthlySalaryReport.update({
          where: { id: reportId },
          data: { adjustmentVersion: { increment: 1 }, updatedAt: now },
        });
      });
      let workbookCurrent = false;
      try {
        workbookCurrent = await refreshMonthlySalaryReportWorkbook(
          database,
          reportId,
        );
      } catch {
        logger.warn(
          { reportId },
          "monthly_salary_report_adjustment_void_refresh_pending",
        );
      }
      response.set("Cache-Control", "private, no-store");
      response.json({ voided: true, workbookCurrent });
    },
  );

  router.get(
    "/admin/salary-reports/:reportId/file",
    requireAuth,
    requireRoles("ADMIN"),
    async (request, response) => {
      const parsedId = reportIdSchema.safeParse(request.params.reportId);
      if (!parsedId.success) {
        throw new HttpError(
          404,
          "MONTHLY_SALARY_REPORT_NOT_FOUND",
          "Отчёт не найден.",
        );
      }
      let report = await database.technicianMonthlySalaryReport.findUnique({
        where: { id: parsedId.data },
        select: {
          fileName: true,
          fileObjectId: true,
          adjustmentVersion: true,
          fileAdjustmentVersion: true,
        },
      });
      if (!report) {
        throw new HttpError(
          404,
          "MONTHLY_SALARY_REPORT_NOT_FOUND",
          "Отчёт не найден.",
        );
      }
      if (report.fileAdjustmentVersion < report.adjustmentVersion) {
        await refreshMonthlySalaryReportWorkbook(database, parsedId.data).catch(
          () => false,
        );
        report = await database.technicianMonthlySalaryReport.findUnique({
          where: { id: parsedId.data },
          select: {
            fileName: true,
            fileObjectId: true,
            adjustmentVersion: true,
            fileAdjustmentVersion: true,
          },
        });
        if (
          !report ||
          report.fileAdjustmentVersion < report.adjustmentVersion
        ) {
          throw new HttpError(
            503,
            "MONTHLY_SALARY_REPORT_REFRESH_PENDING",
            "Отчёт обновляется. Попробуйте скачать его ещё раз чуть позже.",
          );
        }
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.xlsx$/u.test(report.fileName)) {
        throw new HttpError(
          500,
          "MONTHLY_SALARY_REPORT_INVALID_FILE",
          "Не удалось подготовить скачивание отчёта.",
        );
      }
      const file = await downloadProjectFile(report.fileObjectId);
      if (file.contentType !== MONTHLY_SALARY_REPORT_CONTENT_TYPE) {
        throw new HttpError(
          502,
          "MONTHLY_SALARY_REPORT_INVALID_FILE",
          "Файл отчёта имеет неподдерживаемый формат.",
        );
      }
      response.set({
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename="${report.fileName}"`,
        "Content-Type": MONTHLY_SALARY_REPORT_CONTENT_TYPE,
        "X-Content-Type-Options": "nosniff",
      });
      response.status(200).send(file.bytes);
    },
  );

  return router;
};
