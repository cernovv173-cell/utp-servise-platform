export type CalendarDate = { year: number; month: number; day: number };

export type SalaryPeriodRange = { startsAt: Date; endsAt: Date };
export type SalaryPeriodName = "day" | "week" | "month";
export type SalaryPeriodRanges = Record<SalaryPeriodName, SalaryPeriodRange>;

const datePartsAt = (date: Date, timeZone: string): CalendarDate => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  };
};

export const getCalendarDateParts = (
  date: Date,
  timeZone: string,
): CalendarDate => datePartsAt(date, timeZone);

const shiftCalendarDate = (date: CalendarDate, days: number): CalendarDate => {
  const shifted = new Date(
    Date.UTC(date.year, date.month - 1, date.day + days),
  );
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
};

const localMidnightAsDate = (date: CalendarDate, timeZone: string): Date => {
  const targetWallClock = Date.UTC(date.year, date.month - 1, date.day);
  let estimate = targetWallClock;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const values = Object.fromEntries(
      formatter
        .formatToParts(new Date(estimate))
        .map(({ type, value }) => [type, value]),
    );
    const observedWallClock = Date.UTC(
      Number(values.year),
      Number(values.month) - 1,
      Number(values.day),
      Number(values.hour),
      Number(values.minute),
      Number(values.second),
    );
    const correction = targetWallClock - observedWallClock;
    estimate += correction;
    if (correction === 0) break;
  }
  return new Date(estimate);
};

export const getSalaryMonthRangeForCalendarMonth = (
  year: number,
  month: number,
  timeZone: string,
): SalaryPeriodRange => {
  if (
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(month) ||
    month < 1 ||
    month > 12
  ) {
    throw new RangeError("Salary month must be a valid calendar month.");
  }
  const nextMonth =
    month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
  return {
    startsAt: localMidnightAsDate({ year, month, day: 1 }, timeZone),
    endsAt: localMidnightAsDate({ ...nextMonth, day: 1 }, timeZone),
  };
};

export const getSalaryPeriodRanges = (
  now: Date,
  timeZone: string,
): SalaryPeriodRanges => {
  const today = datePartsAt(now, timeZone);
  const weekday = new Date(
    Date.UTC(today.year, today.month - 1, today.day),
  ).getUTCDay();
  const daysFromMonday = (weekday + 6) % 7;
  const weekStart = shiftCalendarDate(today, -daysFromMonday);
  const month = getSalaryMonthRangeForCalendarMonth(
    today.year,
    today.month,
    timeZone,
  );

  return {
    day: {
      startsAt: localMidnightAsDate(today, timeZone),
      endsAt: localMidnightAsDate(shiftCalendarDate(today, 1), timeZone),
    },
    week: {
      startsAt: localMidnightAsDate(weekStart, timeZone),
      endsAt: localMidnightAsDate(shiftCalendarDate(weekStart, 7), timeZone),
    },
    month,
  };
};
