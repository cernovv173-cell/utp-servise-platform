export const DIAGNOSIS_FEE_RUB = 850;
export const OUT_OF_TOWN_RATE_RUB_PER_KM = 25;
export const formatRub = (value: number) => `${new Intl.NumberFormat("ru-RU").format(value)} ₽`;

export const calculateTravelFeeRub = ({
  isWithinPushkino,
  diagnosisCompleted,
  oneWayKm,
}: {
  isWithinPushkino: boolean;
  diagnosisCompleted: boolean;
  oneWayKm: number;
}) => {
  if (isWithinPushkino || !diagnosisCompleted || !Number.isFinite(oneWayKm)) return 0;
  return Math.max(0, oneWayKm) * OUT_OF_TOWN_RATE_RUB_PER_KM;
};

export const calculateTechnicianFeesRub = ({
  isWithinPushkino,
  diagnosisCompleted,
  oneWayKm,
}: {
  isWithinPushkino: boolean;
  diagnosisCompleted: boolean;
  oneWayKm: number;
}) =>
  (diagnosisCompleted ? DIAGNOSIS_FEE_RUB : 0) +
  calculateTravelFeeRub({ isWithinPushkino, diagnosisCompleted, oneWayKm });
