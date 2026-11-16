export const HOLIDAY_CLOSURE_START = Date.parse("2026-12-30T21:00:00.000Z");
export const HOLIDAY_SERVICE_REOPENS = Date.parse("2027-01-11T05:30:00.000Z");

export type HolidayCountdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export type HolidayClosurePhase = "upcoming" | "closed" | "reopened";

export const getHolidayClosurePhase = (now: number): HolidayClosurePhase => {
  if (now < HOLIDAY_CLOSURE_START) return "upcoming";
  if (now >= HOLIDAY_SERVICE_REOPENS) return "reopened";
  return "closed";
};

export const getHolidayCountdown = (now: number): HolidayCountdown | null => {
  if (getHolidayClosurePhase(now) !== "closed") return null;

  let secondsRemaining = Math.ceil((HOLIDAY_SERVICE_REOPENS - now) / 1_000);
  const days = Math.floor(secondsRemaining / 86_400);
  secondsRemaining -= days * 86_400;
  const hours = Math.floor(secondsRemaining / 3_600);
  secondsRemaining -= hours * 3_600;
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining - minutes * 60;

  return { days, hours, minutes, seconds };
};
