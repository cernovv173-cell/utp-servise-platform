const moscowDateFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Moscow",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
});

const MOSCOW_UTC_OFFSET_MILLISECONDS = 3 * 60 * 60 * 1000;
const WEEKDAY_INDEX = new Map([
  ["Sun", 0],
  ["Mon", 1],
  ["Tue", 2],
  ["Wed", 3],
  ["Thu", 4],
  ["Fri", 5],
  ["Sat", 6],
]);

export const getMoscowWeekStart = (now: Date): Date => {
  const parts = Object.fromEntries(
    moscowDateFormatter
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const weekday = WEEKDAY_INDEX.get(parts.weekday ?? "");
  if (weekday === undefined || !year || !month || !day) {
    throw new RangeError("Unable to calculate the Moscow week boundary.");
  }

  const daysSinceMonday = (weekday + 6) % 7;
  const mondayUtcDate = Date.UTC(year, month - 1, day - daysSinceMonday);
  return new Date(mondayUtcDate - MOSCOW_UTC_OFFSET_MILLISECONDS);
};
