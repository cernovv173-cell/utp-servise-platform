import assert from "node:assert/strict";
import test from "node:test";

import { calculateTechnicianSalaryRub } from "../src/features/salary/salary-calculation.js";
import { getSalaryPeriodRanges } from "../src/features/salary/salary-periods.js";

test("salary applies the technician's saved percentage to service work and rounds to the nearest ruble", () => {
  assert.equal(calculateTechnicianSalaryRub(1_500), 1_125);
  assert.equal(calculateTechnicianSalaryRub(1_001), 751);
  assert.equal(calculateTechnicianSalaryRub(0), 0);
  assert.equal(calculateTechnicianSalaryRub(1_500, 60), 900);
  assert.equal(calculateTechnicianSalaryRub(1_500, 0), 0);
});

test("salary periods use local calendar dates and Monday as the week start", () => {
  const ranges = getSalaryPeriodRanges(
    new Date("2026-10-02T12:00:00.000Z"),
    "UTC",
  );

  assert.equal(ranges.day.startsAt.toISOString(), "2026-10-02T00:00:00.000Z");
  assert.equal(ranges.week.startsAt.toISOString(), "2026-09-28T00:00:00.000Z");
  assert.equal(ranges.month.startsAt.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(ranges.week.endsAt.toISOString(), "2026-10-05T00:00:00.000Z");
});

test("salary periods respect daylight-saving offsets in the selected time zone", () => {
  const ranges = getSalaryPeriodRanges(
    new Date("2026-03-09T12:00:00.000Z"),
    "America/New_York",
  );

  assert.equal(ranges.day.startsAt.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(ranges.week.startsAt.toISOString(), "2026-03-09T04:00:00.000Z");
  assert.equal(ranges.day.endsAt.toISOString(), "2026-03-10T04:00:00.000Z");
});
