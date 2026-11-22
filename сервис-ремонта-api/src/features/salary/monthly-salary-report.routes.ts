import { Router } from "express";
import { z } from "zod";

import type { DatabaseClient } from "../../lib/database/database.js";
import { HttpError } from "../../lib/http/http-error.js";
import { downloadProjectFile } from "../../lib/storage/project-images.js";
import { createRequireAuth, requireRoles } from "../auth/auth.middleware.js";
import { MONTHLY_SALARY_REPORT_CONTENT_TYPE } from "./monthly-salary-report-workbook.js";

const reportIdSchema = z.string().uuid();

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
          return {
            id: report.id,
            periodStart: report.periodStart.toISOString().slice(0, 10),
            periodEnd: report.periodEnd.toISOString().slice(0, 10),
            fileName: report.fileName,
            workCount: report.workCount,
            technicianCount: report.technicianCount,
            totalSalaryRub: report.totalSalaryRub,
            generatedAt: report.generatedAt,
            deliveryCounts,
          };
        }),
      });
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
      const report = await database.technicianMonthlySalaryReport.findUnique({
        where: { id: parsedId.data },
        select: { fileName: true, fileObjectId: true },
      });
      if (!report) {
        throw new HttpError(
          404,
          "MONTHLY_SALARY_REPORT_NOT_FOUND",
          "Отчёт не найден.",
        );
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
