import { describe, expect, it } from "vitest";

import {
  DEFAULT_CLOSURE_ANNOUNCEMENT,
  HOLIDAY_CLOSURE_START,
  HOLIDAY_SERVICE_REOPENS,
  getClosureReopens,
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

  it("uses the administrator-configured dates and opening time", () => {
    const settings = {
      ...DEFAULT_CLOSURE_ANNOUNCEMENT,
      startDate: "2026-12-01",
      endDate: "2026-12-02",
      reopenTime: "09:15",
    };
    const reopening = Date.parse("2026-12-03T09:15:00+03:00");

    expect(getClosureReopens(settings)).toBe(reopening);
    expect(getHolidayClosurePhase(Date.parse("2026-12-02T23:59:59+03:00"), settings)).toBe(
      "closed",
    );
    expect(getHolidayClosurePhase(reopening, settings)).toBe("reopened");
    expect(getHolidayCountdown(Date.parse("2026-12-02T23:59:59+03:00"), settings)).toEqual({
      days: 0,
      hours: 9,
      minutes: 15,
      seconds: 1,
    });
  });

  it("does not show a countdown when the administrator disables the announcement", () => {
    expect(
      getHolidayCountdown(HOLIDAY_CLOSURE_START, {
        ...DEFAULT_CLOSURE_ANNOUNCEMENT,
        enabled: false,
      }),
    ).toBeNull();
  });
});
