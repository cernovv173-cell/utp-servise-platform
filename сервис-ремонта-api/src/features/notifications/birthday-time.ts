const MOSCOW_TIME_ZONE = "Europe/Moscow";
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1_000;

const moscowDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: MOSCOW_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const getDateParts = (date: Date) => {
  const parts = moscowDateFormatter.formatToParts(date);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return {
    year: Number(part("year")),
    month: Number(part("month")),
    day: Number(part("day")),
  };
};

const getMoscowOffsetMilliseconds = (instant: Date): number => {
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone: MOSCOW_TIME_ZONE,
    timeZoneName: "longOffset",
  })
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value;
  if (!offset || offset === "GMT") return 0;
  const match = /^GMT([+-])(\d{1,2})(?::(\d{2}))?$/u.exec(offset);
  if (!match) throw new Error("Unable to determine the Moscow UTC offset.");
  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? 0);
  return sign * (hours * 60 + minutes) * 60 * 1_000;
};

export const getMoscowBirthdayDate = (now: Date) => {
  const { year, month, day } = getDateParts(now);
  return {
    year,
    monthDay: `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
};

export const getMoscowBirthdayDayWindow = (now: Date) => {
  const { year, month, day } = getDateParts(now);
  const localDayAsUtc = Date.UTC(year, month - 1, day);
  const nextDayAsUtc = localDayAsUtc + MILLISECONDS_PER_DAY;
  const midday = 12 * 60 * 60 * 1_000;
  const startsAt = new Date(
    localDayAsUtc -
      getMoscowOffsetMilliseconds(new Date(localDayAsUtc + midday)),
  );
  const endsAt = new Date(
    nextDayAsUtc - getMoscowOffsetMilliseconds(new Date(nextDayAsUtc + midday)),
  );
  return { startsAt, endsAt };
};
