export const TECHNICIAN_SALARY_RATE_PERCENT = 75;

export const calculateTechnicianSalaryRub = (serviceTotalRub: number): number =>
  Math.round((serviceTotalRub * TECHNICIAN_SALARY_RATE_PERCENT) / 100);
