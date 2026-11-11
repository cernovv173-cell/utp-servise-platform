import { describe, expect, it } from "vitest";

import { calculateTechnicianFeesRub, calculateTravelFeeRub } from "./scenario-preview-model";

describe("repair scenario preview fees", () => {
  it("keeps a Pushkino visit free even after diagnosis", () => {
    expect(
      calculateTravelFeeRub({
        isWithinPushkino: true,
        diagnosisCompleted: true,
        oneWayKm: 18,
      }),
    ).toBe(0);
  });

  it("charges 25 rubles per one-way kilometer only after diagnosis", () => {
    expect(
      calculateTravelFeeRub({
        isWithinPushkino: false,
        diagnosisCompleted: true,
        oneWayKm: 18,
      }),
    ).toBe(450);
    expect(
      calculateTravelFeeRub({
        isWithinPushkino: false,
        diagnosisCompleted: false,
        oneWayKm: 18,
      }),
    ).toBe(0);
  });

  it("adds the one-time diagnosis fee to the technician's travel fee", () => {
    expect(
      calculateTechnicianFeesRub({
        isWithinPushkino: false,
        diagnosisCompleted: true,
        oneWayKm: 18,
      }),
    ).toBe(1_300);
  });
});
