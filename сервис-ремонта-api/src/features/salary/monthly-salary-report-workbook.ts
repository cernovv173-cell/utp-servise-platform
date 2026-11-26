import ExcelJS from "exceljs";

import type { DatabaseClient } from "../../lib/database/database.js";
import {
  type MonthlySalaryReportAdjustment,
  summarizeMonthlySalarySettlements,
} from "./monthly-salary-report-adjustments.js";
import type { SalaryPeriodRange } from "./salary-periods.js";

export const MONTHLY_SALARY_REPORT_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export type MonthlySalaryWorkLine = {
  readonly technicianId: string | null;
  readonly technicianName: string;
  readonly earnedAt: Date;
  readonly workType: "Ремонт" | "Заказ";
  readonly serviceNumber: string;
  readonly serviceTotalRub: number;
  readonly visitFeesRub: number;
  readonly ratePercent: number;
  readonly salaryRub: number;
};

export type MonthlySalaryTechnicianSummary = {
  readonly technicianId: string | null;
  readonly technicianName: string;
  readonly workCount: number;
  readonly serviceTotalRub: number;
  readonly visitFeesRub: number;
  readonly salaryRub: number;
};

export type MonthlySalaryReportData = {
  readonly lines: readonly MonthlySalaryWorkLine[];
  readonly summaries: readonly MonthlySalaryTechnicianSummary[];
  readonly workCount: number;
  readonly technicianCount: number;
  readonly totalSalaryRub: number;
};

const UNKNOWN_TECHNICIAN_ID = "__unknown_technician__";
const UNKNOWN_TECHNICIAN_NAME = "Мастер не указан";

export const loadMonthlySalaryReportData = async (
  database: DatabaseClient,
  range: SalaryPeriodRange,
): Promise<MonthlySalaryReportData> => {
  const earnedAt = { gte: range.startsAt, lt: range.endsAt };
  const [technicians, repairEntries, craftEntries] = await Promise.all([
    database.user.findMany({
      where: {
        OR: [
          {
            role: "TECHNICIAN",
            OR: [
              { staffPermissionsConfigured: false },
              { staffPermissions: { has: "repairs" } },
            ],
          },
        ],
      },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
    database.technicianSalaryEntry.findMany({
      where: { earnedAt },
      select: {
        technicianId: true,
        technician: { select: { displayName: true } },
        earnedAt: true,
        serviceTotalRub: true,
        visitFeesRub: true,
        ratePercent: true,
        salaryRub: true,
        order: { select: { serviceNumber: true } },
      },
      orderBy: [{ earnedAt: "asc" }, { createdAt: "asc" }],
    }),
    database.craftOrderSalaryEntry.findMany({
      where: { earnedAt },
      select: {
        technicianId: true,
        technician: { select: { displayName: true } },
        earnedAt: true,
        serviceTotalRub: true,
        ratePercent: true,
        salaryRub: true,
        craftOrder: { select: { serviceNumber: true } },
      },
      orderBy: [{ earnedAt: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const lines: MonthlySalaryWorkLine[] = [
    ...repairEntries.map((entry) => ({
      technicianId: entry.technicianId,
      technicianName: entry.technician?.displayName ?? UNKNOWN_TECHNICIAN_NAME,
      earnedAt: entry.earnedAt,
      workType: "Ремонт" as const,
      serviceNumber: entry.order.serviceNumber ?? "—",
      serviceTotalRub: entry.serviceTotalRub,
      visitFeesRub: entry.visitFeesRub,
      ratePercent: entry.ratePercent,
      salaryRub: entry.salaryRub,
    })),
    ...craftEntries.map((entry) => ({
      technicianId: entry.technicianId,
      technicianName: entry.technician?.displayName ?? UNKNOWN_TECHNICIAN_NAME,
      earnedAt: entry.earnedAt,
      workType: "Заказ" as const,
      serviceNumber: entry.craftOrder.serviceNumber ?? "—",
      serviceTotalRub: entry.serviceTotalRub,
      visitFeesRub: 0,
      ratePercent: entry.ratePercent,
      salaryRub: entry.salaryRub,
    })),
  ].sort((left, right) => left.earnedAt.getTime() - right.earnedAt.getTime());

  const summaryByTechnician = new Map<
    string,
    {
      technicianId: string | null;
      technicianName: string;
      workCount: number;
      serviceTotalRub: number;
      visitFeesRub: number;
      salaryRub: number;
    }
  >();

  for (const technician of technicians) {
    summaryByTechnician.set(technician.id, {
      technicianId: technician.id,
      technicianName: technician.displayName,
      workCount: 0,
      serviceTotalRub: 0,
      visitFeesRub: 0,
      salaryRub: 0,
    });
  }

  for (const line of lines) {
    const key = line.technicianId ?? UNKNOWN_TECHNICIAN_ID;
    const current = summaryByTechnician.get(key) ?? {
      technicianId: line.technicianId,
      technicianName: line.technicianName,
      workCount: 0,
      serviceTotalRub: 0,
      visitFeesRub: 0,
      salaryRub: 0,
    };
    summaryByTechnician.set(key, {
      ...current,
      workCount: current.workCount + 1,
      serviceTotalRub: current.serviceTotalRub + line.serviceTotalRub,
      visitFeesRub: current.visitFeesRub + line.visitFeesRub,
      salaryRub: current.salaryRub + line.salaryRub,
    });
  }

  const summaries = [...summaryByTechnician.values()].sort((left, right) =>
    left.technicianName.localeCompare(right.technicianName),
  );
  return {
    lines,
    summaries,
    workCount: lines.length,
    technicianCount: summaries.length,
    totalSalaryRub: summaries.reduce((total, row) => total + row.salaryRub, 0),
  };
};

const setHeaderStyle = (worksheet: ExcelJS.Worksheet): void => {
  const header = worksheet.getRow(4);
  header.height = 30;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF17324D" },
    };
    cell.alignment = { vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF8AA0B5" } },
    };
  });
  worksheet.views = [{ state: "frozen", ySplit: 4 }];
  worksheet.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: worksheet.columnCount },
  };
};

const addReportTitle = (
  worksheet: ExcelJS.Worksheet,
  periodLabel: string,
  columnCount: number,
): void => {
  worksheet.mergeCells(1, 1, 1, columnCount);
  worksheet.getCell(1, 1).value = "ЕНОТ СЕРВИС — начисления мастерам";
  worksheet.getCell(1, 1).font = {
    bold: true,
    size: 16,
    color: { argb: "FF17324D" },
  };
  worksheet.getRow(1).height = 26;
  worksheet.mergeCells(2, 1, 2, columnCount);
  worksheet.getCell(2, 1).value = `Период: ${periodLabel} (Europe/Moscow)`;
  worksheet.getCell(2, 1).font = { bold: true, size: 11 };
  worksheet.mergeCells(3, 1, 3, columnCount);
  worksheet.getCell(3, 1).value =
    "Налог вводится вручную. Остаток = начисление − налог − аванс − удержания; это внутренний расчёт, не налоговый документ.";
  worksheet.getCell(3, 1).font = { italic: true, color: { argb: "FF526474" } };
};

const toExcelMoscowDate = (date: Date): Date => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Moscow",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map(({ type, value }) => [type, value]),
  );
  return new Date(
    Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    ),
  );
};

export const buildMonthlySalaryWorkbook = async (input: {
  readonly data: MonthlySalaryReportData;
  readonly adjustments: readonly MonthlySalaryReportAdjustment[];
  readonly periodLabel: string;
  readonly generatedAt: Date;
}): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ЕНОТ СЕРВИС";
  workbook.created = input.generatedAt;
  workbook.modified = input.generatedAt;
  workbook.subject = "Ежемесячный отчёт по начислениям мастеров";
  workbook.title = `Начисления мастерам — ${input.periodLabel}`;
  const { settlements, totals } = summarizeMonthlySalarySettlements(
    input.data,
    input.adjustments,
  );

  const summary = workbook.addWorksheet("Сводка", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  summary.columns = [
    { header: "Мастер", key: "technicianName", width: 30 },
    { header: "Работ", key: "workCount", width: 12 },
    { header: "Работы, ₽", key: "serviceTotalRub", width: 18 },
    { header: "Диагностика и выезды, ₽", key: "visitFeesRub", width: 24 },
    { header: "Начислено, ₽", key: "salaryRub", width: 20 },
    { header: "Налог, ₽", key: "taxRub", width: 16 },
    { header: "Авансы, ₽", key: "advanceRub", width: 16 },
    { header: "Удержания, ₽", key: "deductionRub", width: 18 },
    { header: "Остаток к выплате, ₽", key: "netPayRub", width: 23 },
  ];
  addReportTitle(summary, input.periodLabel, 9);
  summary.addRow([
    "Мастер",
    "Работ",
    "Работы, ₽",
    "Диагностика и выезды, ₽",
    "Начислено, ₽",
    "Налог, ₽",
    "Авансы, ₽",
    "Удержания, ₽",
    "Остаток к выплате, ₽",
  ]);
  for (const row of settlements) {
    summary.addRow([
      row.technicianName,
      row.workCount,
      row.serviceTotalRub,
      row.visitFeesRub,
      row.salaryRub,
      row.taxRub,
      row.advanceRub,
      row.deductionRub,
      row.netPayRub,
    ]);
  }
  summary.addRow([
    "ИТОГО",
    input.data.workCount,
    settlements.reduce((total, row) => total + row.serviceTotalRub, 0),
    settlements.reduce((total, row) => total + row.visitFeesRub, 0),
    input.data.totalSalaryRub,
    totals.taxRub,
    totals.advanceRub,
    totals.deductionRub,
    totals.netPayRub,
  ]);
  summary.getColumn(2).numFmt = "0";
  for (const column of [3, 4, 5, 6, 7, 8, 9])
    summary.getColumn(column).numFmt = '#,##0 "₽"';
  setHeaderStyle(summary);
  summary.getRow(summary.rowCount).font = { bold: true };

  const details = workbook.addWorksheet("Работы");
  details.columns = [
    { header: "Дата начисления", key: "earnedAt", width: 20 },
    { header: "Мастер", key: "technicianName", width: 30 },
    { header: "Тип работы", key: "workType", width: 18 },
    { header: "Сервисный номер", key: "serviceNumber", width: 22 },
    { header: "Работы, ₽", key: "serviceTotalRub", width: 18 },
    { header: "Диагностика и выезды, ₽", key: "visitFeesRub", width: 24 },
    { header: "Ставка, %", key: "ratePercent", width: 14 },
    { header: "Начислено, ₽", key: "salaryRub", width: 20 },
  ];
  addReportTitle(details, input.periodLabel, 8);
  details.addRow([
    "Дата начисления",
    "Мастер",
    "Тип работы",
    "Сервисный номер",
    "Работы, ₽",
    "Диагностика и выезды, ₽",
    "Ставка, %",
    "Начислено, ₽",
  ]);
  for (const line of input.data.lines) {
    details.addRow([
      toExcelMoscowDate(line.earnedAt),
      line.technicianName,
      line.workType,
      line.serviceNumber,
      line.serviceTotalRub,
      line.visitFeesRub,
      line.ratePercent / 100,
      line.salaryRub,
    ]);
  }
  details.getColumn(1).numFmt = "dd.mm.yyyy hh:mm";
  details.getColumn(7).numFmt = "0%";
  for (const column of [5, 6, 8])
    details.getColumn(column).numFmt = '#,##0 "₽"';
  setHeaderStyle(details);

  const adjustmentSheet = workbook.addWorksheet("Налог и удержания");
  adjustmentSheet.columns = [
    { header: "Дата", key: "occurredAt", width: 18 },
    { header: "Мастер", key: "technicianName", width: 28 },
    { header: "Вид записи", key: "type", width: 18 },
    { header: "Описание", key: "description", width: 36 },
    { header: "Сумма, ₽", key: "amountRub", width: 18 },
    { header: "Записал", key: "createdByName", width: 24 },
    { header: "Статус", key: "status", width: 16 },
    { header: "Причина отмены", key: "voidReason", width: 36 },
  ];
  addReportTitle(adjustmentSheet, input.periodLabel, 8);
  adjustmentSheet.addRow([
    "Дата",
    "Мастер",
    "Вид записи",
    "Описание",
    "Сумма, ₽",
    "Записал",
    "Статус",
    "Причина отмены",
  ]);
  const adjustmentLabels = {
    TAX: "Налог",
    ADVANCE: "Аванс",
    DEDUCTION: "Удержание",
  } as const;
  for (const adjustment of input.adjustments) {
    adjustmentSheet.addRow([
      toExcelMoscowDate(adjustment.occurredAt),
      adjustment.technicianName,
      adjustmentLabels[adjustment.type],
      adjustment.description,
      adjustment.amountRub,
      adjustment.createdByName,
      adjustment.voidedAt ? "Отменено" : "Действует",
      adjustment.voidReason ?? "",
    ]);
  }
  adjustmentSheet.getColumn(1).numFmt = "dd.mm.yyyy";
  adjustmentSheet.getColumn(5).numFmt = '#,##0 "₽"';
  setHeaderStyle(adjustmentSheet);

  const bytes = await workbook.xlsx.writeBuffer();
  return Buffer.from(bytes);
};
