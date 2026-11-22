import type { MonthlySalaryReportData } from "./monthly-salary-report-workbook.js";

export type TechnicianPayrollAdjustmentType = "TAX" | "ADVANCE" | "DEDUCTION";

export type MonthlySalaryReportAdjustment = {
  readonly id: string;
  readonly technicianId: string | null;
  readonly technicianName: string;
  readonly type: TechnicianPayrollAdjustmentType;
  readonly amountRub: number;
  readonly description: string;
  readonly occurredAt: Date;
  readonly createdByName: string;
  readonly voidedAt: Date | null;
  readonly voidedByName: string | null;
  readonly voidReason: string | null;
};

export type MonthlySalarySettlement = {
  readonly technicianId: string | null;
  readonly technicianName: string;
  readonly workCount: number;
  readonly serviceTotalRub: number;
  readonly visitFeesRub: number;
  readonly salaryRub: number;
  readonly taxRub: number;
  readonly advanceRub: number;
  readonly deductionRub: number;
  readonly netPayRub: number;
};

export type MonthlySalarySettlementTotals = {
  readonly taxRub: number;
  readonly advanceRub: number;
  readonly deductionRub: number;
  readonly netPayRub: number;
};

type MutableSettlement = {
  technicianId: string | null;
  technicianName: string;
  workCount: number;
  serviceTotalRub: number;
  visitFeesRub: number;
  salaryRub: number;
  taxRub: number;
  advanceRub: number;
  deductionRub: number;
};

const newSettlement = (
  technicianId: string | null,
  technicianName: string,
  base?: MonthlySalaryReportData["summaries"][number],
): MutableSettlement => ({
  technicianId,
  technicianName,
  workCount: base?.workCount ?? 0,
  serviceTotalRub: base?.serviceTotalRub ?? 0,
  visitFeesRub: base?.visitFeesRub ?? 0,
  salaryRub: base?.salaryRub ?? 0,
  taxRub: 0,
  advanceRub: 0,
  deductionRub: 0,
});

export const summarizeMonthlySalarySettlements = (
  reportData: MonthlySalaryReportData,
  adjustments: readonly MonthlySalaryReportAdjustment[],
): {
  readonly settlements: MonthlySalarySettlement[];
  readonly totals: MonthlySalarySettlementTotals;
} => {
  const settlements = new Map<string, ReturnType<typeof newSettlement>>();
  for (const summary of reportData.summaries) {
    settlements.set(
      summary.technicianId ?? "__unknown__",
      newSettlement(summary.technicianId, summary.technicianName, summary),
    );
  }

  for (const adjustment of adjustments) {
    const key =
      adjustment.technicianId ?? `__deleted__:${adjustment.technicianName}`;
    const current =
      settlements.get(key) ?? newSettlement(key, adjustment.technicianName);
    if (!adjustment.voidedAt) {
      if (adjustment.type === "TAX") {
        current.taxRub += adjustment.amountRub;
      } else if (adjustment.type === "ADVANCE") {
        current.advanceRub += adjustment.amountRub;
      } else {
        current.deductionRub += adjustment.amountRub;
      }
    }
    settlements.set(key, current);
  }

  const rows = [...settlements.values()]
    .map((summary) => ({
      ...summary,
      netPayRub:
        summary.salaryRub -
        summary.taxRub -
        summary.advanceRub -
        summary.deductionRub,
    }))
    .sort((left, right) =>
      left.technicianName.localeCompare(right.technicianName),
    );

  return {
    settlements: rows,
    totals: rows.reduce(
      (totals, summary) => ({
        taxRub: totals.taxRub + summary.taxRub,
        advanceRub: totals.advanceRub + summary.advanceRub,
        deductionRub: totals.deductionRub + summary.deductionRub,
        netPayRub: totals.netPayRub + summary.netPayRub,
      }),
      { taxRub: 0, advanceRub: 0, deductionRub: 0, netPayRub: 0 },
    ),
  };
};
