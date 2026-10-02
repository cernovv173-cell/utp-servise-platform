type CalendarDate = { year: number; month: number; day: number };

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
  const monthStart = { year: today.year, month: today.month, day: 1 };

  return {
    day: {
      startsAt: localMidnightAsDate(today, timeZone),
      endsAt: localMidnightAsDate(shiftCalendarDate(today, 1), timeZone),
    },
    week: {
      startsAt: localMidnightAsDate(weekStart, timeZone),
      endsAt: localMidnightAsDate(shiftCalendarDate(weekStart, 7), timeZone),
    },
    month: {
      startsAt: localMidnightAsDate(monthStart, timeZone),
      endsAt: localMidnightAsDate(
        monthStart.month === 12
          ? { year: monthStart.year + 1, month: 1, day: 1 }
          : { year: monthStart.year, month: monthStart.month + 1, day: 1 },
        timeZone,
      ),
    },
  };
};
