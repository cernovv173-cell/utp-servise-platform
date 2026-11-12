import { CheckCircle2, Flower2, Leaf, Snowflake, Sun } from "lucide-react";

import type { SeasonalSeason, SeasonalSeasonChoice } from "@/lib/api";

const seasonDetails = {
  SPRING: {
    label: "Весеннее обновление",
    title: "Время для свежего старта — даже у техники.",
    image: "/images/seasonal-spring-banner.webp",
    icon: Flower2,
    surfaceClass: "border-emerald-100/40 bg-[#17382f]",
    overlayClass: "from-[#10352d] via-[#10352d]/85 to-[#10352d]/10",
    accentClass: "text-emerald-200",
  },
  SUMMER: {
    label: "Летний режим",
    title: "Пусть летом греет солнце, а не техника.",
    image: "/images/seasonal-summer-banner.webp",
    icon: Sun,
    surfaceClass: "border-amber-100/40 bg-[#3b321b]",
    overlayClass: "from-[#312711] via-[#312711]/82 to-[#312711]/10",
    accentClass: "text-amber-200",
  },
  AUTUMN: {
    label: "Уютная осень",
    title: "Домашний уют начинается с надёжной техники.",
    image: "/images/seasonal-autumn-banner.webp",
    icon: Leaf,
    surfaceClass: "border-orange-100/40 bg-[#3b2117]",
    overlayClass: "from-[#35190f] via-[#35190f]/82 to-[#35190f]/10",
    accentClass: "text-orange-200",
  },
  WINTER: {
    label: "Зимнее настроение",
    title: "Пусть в новом году техника работает без сбоев.",
    image: "/images/new-year-raccoon.webp",
    icon: Snowflake,
    surfaceClass: "border-amber-100/30 bg-[#10203a]",
    overlayClass: "from-[#0b1830] via-[#0b1830]/90 to-[#0b1830]/10",
    accentClass: "text-amber-200",
  },
} satisfies Record<
  SeasonalSeason,
  {
    label: string;
    title: string;
    image: string;
    icon: typeof Leaf;
    surfaceClass: string;
    overlayClass: string;
    accentClass: string;
  }
>;

const benefits = [
  "Диагностика до начала работ",
  "Связь с сервисом в аккаунте",
  "Чек и гарантия после ремонта",
];

export const SeasonalHomeBanner = ({
  season,
  className = "",
}: {
  season: SeasonalSeasonChoice;
  className?: string;
}) => {
  if (season === "NONE") return null;

  const details = seasonDetails[season];
  const SeasonIcon = details.icon;
  const isWinter = season === "WINTER";

  return (
    <section
      aria-label={`${details.label}: оформление ЕНОТ СЕРВИС`}
      className={`relative isolate flex min-h-[230px] overflow-hidden rounded-[2rem] border p-6 text-white shadow-[0_24px_70px_rgba(15,35,63,0.2)] sm:min-h-[260px] sm:p-8 ${details.surfaceClass} ${className}`}
    >
      <img
        src={details.image}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
      />
      <div className={`absolute inset-0 bg-gradient-to-r ${details.overlayClass}`} />
      <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
      <div className="relative z-10 flex max-w-[74%] flex-col justify-center">
        <div className="mb-3 flex items-center gap-2">
          {isWinter && (
            <img
              src="/images/new-year-snowman.webp"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="size-8 shrink-0 rounded-xl border border-white/35 bg-[#eaf4ff] object-cover shadow-sm"
            />
          )}
          <span
            className={`grid size-8 shrink-0 place-items-center rounded-xl bg-white/15 ${details.accentClass}`}
          >
            <SeasonIcon size={17} aria-hidden="true" />
          </span>
          <p
            className={`text-[9px] font-bold tracking-[0.12em] uppercase sm:text-xs ${details.accentClass}`}
          >
            {details.label}
          </p>
          {isWinter && (
            <img
              src="/images/new-year-tree.webp"
              alt=""
              aria-hidden="true"
              loading="lazy"
              decoding="async"
              className="size-8 shrink-0 rounded-xl border border-white/35 bg-[#eaf4ff] object-cover shadow-sm"
            />
          )}
        </div>
        <h2 className="max-w-sm text-xl leading-tight font-semibold sm:text-2xl">
          {details.title}
        </h2>
        <div className="mt-4 grid gap-2 text-xs text-white/90 sm:text-sm">
          {benefits.map((item) => (
            <p key={item} className="flex items-center gap-2">
              <CheckCircle2
                size={15}
                className={`shrink-0 ${details.accentClass}`}
                aria-hidden="true"
              />
              {item}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
};
