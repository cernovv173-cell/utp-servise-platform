export const SEASONS = ["SPRING", "SUMMER", "AUTUMN", "WINTER"] as const;

export type Season = (typeof SEASONS)[number];
export type SeasonChoice = Season | "NONE";

export type SeasonCalendar = {
  readonly calendarSeason: Season;
  readonly seasonStartsOn: string;
  readonly nextSeason: Season;
  readonly nextSeasonStartsOn: string;
};

const MOSCOW_TIME_ZONE = "Europe/Moscow";

const calendarDate = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, "0")}-01`;

export const getSeasonCalendar = (instant: Date): SeasonCalendar => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MOSCOW_TIME_ZONE,
    year: "numeric",
    month: "numeric",
  }).formatToParts(instant);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  if (!Number.isInteger(year) || month < 1 || month > 12) {
    throw new RangeError("A valid date is required to determine the season.");
  }

  if (month <= 2) {
    return {
      calendarSeason: "WINTER",
      seasonStartsOn: calendarDate(year - 1, 12),
      nextSeason: "SPRING",
      nextSeasonStartsOn: calendarDate(year, 3),
    };
  }
  if (month <= 5) {
    return {
      calendarSeason: "SPRING",
      seasonStartsOn: calendarDate(year, 3),
      nextSeason: "SUMMER",
      nextSeasonStartsOn: calendarDate(year, 6),
    };
  }
  if (month <= 8) {
    return {
      calendarSeason: "SUMMER",
      seasonStartsOn: calendarDate(year, 6),
      nextSeason: "AUTUMN",
      nextSeasonStartsOn: calendarDate(year, 9),
    };
  }
  if (month <= 11) {
    return {
      calendarSeason: "AUTUMN",
      seasonStartsOn: calendarDate(year, 9),
      nextSeason: "WINTER",
      nextSeasonStartsOn: calendarDate(year, 12),
    };
  }
  return {
    calendarSeason: "WINTER",
    seasonStartsOn: calendarDate(year, 12),
    nextSeason: "SPRING",
    nextSeasonStartsOn: calendarDate(year + 1, 3),
  };
};
