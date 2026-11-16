import { describe, expect, it } from "vitest";

import {
  HOLIDAY_CLOSURE_START,
  HOLIDAY_SERVICE_REOPENS,
  getHolidayClosurePhase,
  getHolidayCountdown,
} from "./holiday-closure";

describe("holiday closure countdown", () => {
  it("starts at midnight Moscow time on December 31", () => {
    expect(HOLIDAY_CLOSURE_START).toBe(Date.parse("2026-12-31T00:00:00+03:00"));
    expect(getHolidayCountdown(HOLIDAY_CLOSURE_START)).toEqual({
      days: 11,
      hours: 8,
      minutes: 30,
      seconds: 0,
    });
  });

  it("remains visible on January 10 and counts down to the scheduled opening", () => {
    const januaryTenth = Date.parse("2027-01-10T23:59:59+03:00");

    expect(getHolidayCountdown(januaryTenth)).toEqual({
      days: 0,
      hours: 8,
      minutes: 30,
      seconds: 1,
    });
  });

  it("is hidden before the closure and at the opening time", () => {
    expect(getHolidayCountdown(HOLIDAY_CLOSURE_START - 1)).toBeNull();
    expect(getHolidayCountdown(HOLIDAY_SERVICE_REOPENS)).toBeNull();
    expect(getHolidayClosurePhase(HOLIDAY_CLOSURE_START - 1)).toBe("upcoming");
    expect(getHolidayClosurePhase(HOLIDAY_SERVICE_REOPENS)).toBe("reopened");
  });
});
