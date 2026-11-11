export const REPAIR_DIAGNOSIS_FEE_RUB = 850;
export const REPAIR_VISIT_RUB_PER_KM = 25;

export const calculateRepairVisitFeeRub = ({
  visitScenarioVersion,
  repairLocation,
  isWithinCity,
  verifiedDistanceKm,
  diagnosisCompleted,
}: {
  visitScenarioVersion: number;
  repairLocation: string | null;
  isWithinCity: boolean | null;
  verifiedDistanceKm: number | null;
  diagnosisCompleted: boolean;
}): number => {
  if (
    visitScenarioVersion < 1 ||
    repairLocation !== "CUSTOMER_ADDRESS" ||
    isWithinCity !== false ||
    !diagnosisCompleted ||
    verifiedDistanceKm === null
  ) {
    return 0;
  }

  return Math.max(0, verifiedDistanceKm) * REPAIR_VISIT_RUB_PER_KM;
};

export const calculateRepairOrderTotalRub = ({
  serviceAndPartTotalRub,
  diagnosisFeeRub,
  visitFeeRub,
}: {
  serviceAndPartTotalRub: number;
  diagnosisFeeRub: number;
  visitFeeRub: number;
}): number => serviceAndPartTotalRub + diagnosisFeeRub + visitFeeRub;
