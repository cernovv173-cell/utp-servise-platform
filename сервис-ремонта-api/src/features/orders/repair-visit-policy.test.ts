import assert from "node:assert/strict";
import test from "node:test";

import {
  REPAIR_DIAGNOSIS_FEE_RUB,
  calculateRepairOrderTotalRub,
  calculateRepairVisitFeeRub,
} from "./repair-visit-policy.js";

test("charges one-way travel only after diagnosis for outside-city visits", () => {
  assert.equal(
    calculateRepairVisitFeeRub({
      visitScenarioVersion: 1,
      repairLocation: "CUSTOMER_ADDRESS",
      isWithinCity: false,
      verifiedDistanceKm: 12,
      diagnosisCompleted: true,
    }),
    300,
  );
});

test("does not charge travel inside Pushkino, without diagnosis, or for legacy orders", () => {
  const base = {
    visitScenarioVersion: 1,
    repairLocation: "CUSTOMER_ADDRESS",
    isWithinCity: false,
    verifiedDistanceKm: 12,
    diagnosisCompleted: true,
  };
  assert.equal(calculateRepairVisitFeeRub({ ...base, isWithinCity: true }), 0);
  assert.equal(
    calculateRepairVisitFeeRub({ ...base, diagnosisCompleted: false }),
    0,
  );
  assert.equal(
    calculateRepairVisitFeeRub({ ...base, visitScenarioVersion: 0 }),
    0,
  );
});

test("keeps diagnosis and travel fees separate from the repair subtotal", () => {
  assert.equal(REPAIR_DIAGNOSIS_FEE_RUB, 850);
  assert.equal(
    calculateRepairOrderTotalRub({
      serviceAndPartTotalRub: 2400,
      diagnosisFeeRub: REPAIR_DIAGNOSIS_FEE_RUB,
      visitFeeRub: 300,
    }),
    3550,
  );
});
