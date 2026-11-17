import type { ClosureAnnouncementSettings } from "@/lib/api";

export const CLOSURE_ANNOUNCEMENT_QUERY_KEY = ["closure-announcement"] as const;

export const DEFAULT_CLOSURE_ANNOUNCEMENT: ClosureAnnouncementSettings = {
  enabled: true,
  title: "НОВОГОДНИЙ ПЕРЕРЫВ",
  message: "Сервис временно не работает",
  startDate: "2026-12-31",
  endDate: "2027-01-10",
  reopenTime: "08:30",
  phoneNumber: "",
};

export const HOLIDAY_CLOSURE_START = Date.parse("2026-12-31T00:00:00+03:00");
export const HOLIDAY_SERVICE_REOPENS = Date.parse("2027-01-11T08:30:00+03:00");

export type HolidayCountdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
};

export type HolidayClosurePhase = "upcoming" | "closed" | "reopened";

const nextDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return next.toISOString().slice(0, 10);
};

export const getClosureStart = (settings: ClosureAnnouncementSettings) =>
  Date.parse(`${settings.startDate}T00:00:00+03:00`);

export const getClosureReopens = (settings: ClosureAnnouncementSettings) =>
  Date.parse(`${nextDate(settings.endDate)}T${settings.reopenTime}:00+03:00`);

export const getHolidayClosurePhase = (
  now: number,
  settings: ClosureAnnouncementSettings = DEFAULT_CLOSURE_ANNOUNCEMENT,
): HolidayClosurePhase => {
  if (now < getClosureStart(settings)) return "upcoming";
  if (now >= getClosureReopens(settings)) return "reopened";
  return "closed";
};

export const getHolidayCountdown = (
  now: number,
  settings: ClosureAnnouncementSettings = DEFAULT_CLOSURE_ANNOUNCEMENT,
): HolidayCountdown | null => {
  if (!settings.enabled || getHolidayClosurePhase(now, settings) !== "closed") return null;

  let secondsRemaining = Math.ceil((getClosureReopens(settings) - now) / 1_000);
  const days = Math.floor(secondsRemaining / 86_400);
  secondsRemaining -= days * 86_400;
  const hours = Math.floor(secondsRemaining / 3_600);
  secondsRemaining -= hours * 3_600;
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining - minutes * 60;

  return { days, hours, minutes, seconds };
};

const formatRussianDate = (date: string) => {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

export const getClosureScheduleText = (settings: ClosureAnnouncementSettings) => {
  const reopensDate = nextDate(settings.endDate);
  return `Перерыв — с ${formatRussianDate(settings.startDate)} по ${formatRussianDate(settings.endDate)} включительно. Откроемся ${formatRussianDate(reopensDate)} в ${settings.reopenTime} по московскому времени.`;
};
