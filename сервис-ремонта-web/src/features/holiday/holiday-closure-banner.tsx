import { Clock3, Phone, Snowflake } from "lucide-react";
import { useEffect, useState } from "react";

import {
  HOLIDAY_CLOSURE_START,
  getHolidayClosurePhase,
  getHolidayCountdown,
} from "./holiday-closure";

type HolidayClosureBannerProps = {
  phoneNumber?: string;
};

const countdownItems = [
  ["days", "ДНЕЙ"],
  ["hours", "ЧАСОВ"],
  ["minutes", "МИНУТ"],
  ["seconds", "СЕКУНД"],
] as const;

export const HolidayClosureBanner = ({ phoneNumber }: HolidayClosureBannerProps) => {
  const [now, setNow] = useState(() => Date.now());
  const phase = getHolidayClosurePhase(now);
  useEffect(() => {
    if (phase === "upcoming") {
      const timeout = window.setTimeout(
        () => setNow(Date.now()),
        Math.max(0, HOLIDAY_CLOSURE_START - Date.now()),
      );
      return () => window.clearTimeout(timeout);
    }
    if (phase === "closed") {
      const interval = window.setInterval(() => setNow(Date.now()), 1_000);
      return () => window.clearInterval(interval);
    }
  }, [phase]);

  const countdown = getHolidayCountdown(now);
  if (!countdown) return null;

  const dialNumber = phoneNumber?.replace(/[^\d+]/gu, "");

  return (
    <section
      aria-label="График работы в новогодние праздники"
      className="mx-auto w-full max-w-7xl px-4 py-5 md:px-8 md:py-7"
    >
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-950 p-6 text-white shadow-[0_24px_70px_rgba(30,64,175,0.25)] sm:p-9">
        <div className="pointer-events-none absolute -top-20 -right-14 size-64 rounded-full border border-white/10" />
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.14em] uppercase">
              <Snowflake size={15} aria-hidden="true" />
              Новогодний перерыв
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">
              Сервис временно не работает
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-blue-100 sm:text-base">
              Перерыв — с 31 декабря 2026 по 10 января 2027 включительно. Откроемся 11 января 2027
              года в 08:30 по московскому времени.
            </p>
            {dialNumber && (
              <a
                href={`tel:${dialNumber}`}
                className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/35 bg-white/10 px-4 text-sm font-semibold text-white transition hover:bg-white/20"
                aria-label={`Если заказ срочный, позвоните по номеру ${phoneNumber}`}
              >
                <Phone size={17} aria-hidden="true" />
                Если заказ срочный — звоните: {phoneNumber}
              </a>
            )}
          </div>

          <div className="rounded-2xl border border-white/15 bg-slate-950/25 p-4 backdrop-blur sm:p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-bold tracking-[0.14em] text-blue-100 uppercase">
              <Clock3 size={15} aria-hidden="true" />
              До открытия
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {countdownItems.map(([key, label]) => (
                <div
                  key={key}
                  className="rounded-xl border border-white/10 bg-white/10 px-2 py-3 text-center"
                >
                  <p className="font-mono text-3xl leading-none font-bold tabular-nums sm:text-4xl">
                    {String(countdown[key]).padStart(2, "0")}
                  </p>
                  <p className="mt-2 text-[10px] font-semibold tracking-[0.12em] text-blue-100 sm:text-xs">
                    {label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
