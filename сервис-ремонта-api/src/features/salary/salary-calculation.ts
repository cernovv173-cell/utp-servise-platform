export const TECHNICIAN_SALARY_RATE_PERCENT = 75;

export const calculateTechnicianSalaryRub = (
  serviceTotalRub: number,
  ratePercent = TECHNICIAN_SALARY_RATE_PERCENT,
): number => Math.round((serviceTotalRub * ratePercent) / 100);
