import { Flower2, Leaf, Snowflake, Sparkles } from "lucide-react";

import { SeasonalArtwork } from "@/features/seasonal/seasonal-artwork";

import type { SeasonalSeason, SeasonalSeasonChoice } from "@/lib/api";

const seasonLabels: Record<SeasonalSeason, string> = {
  SPRING: "Весна",
  SUMMER: "Лето",
  AUTUMN: "Осень",
  WINTER: "Зима",
};

const particleIcons = {
  SPRING: Flower2,
  SUMMER: Sparkles,
  AUTUMN: Leaf,
  WINTER: Snowflake,
} satisfies Record<SeasonalSeason, typeof Leaf>;

const particlePositions = [
  { left: "20%", top: "14%", delay: 0 },
  { left: "42%", top: "62%", delay: 1.4 },
  { left: "63%", top: "22%", delay: 2.7 },
  { left: "82%", top: "68%", delay: 0.8 },
  { left: "91%", top: "12%", delay: 3.5 },
];

export const SeasonalSceneBanner = ({ season }: { season: SeasonalSeasonChoice }) => {
  if (season === "NONE") return null;

  const ParticleIcon = particleIcons[season];
  const particleMotion =
    season === "SUMMER" ? "seasonal-particle seasonal-sparkle" : "seasonal-particle seasonal-drift";

  return (
    <section
      aria-label={`Сезонное оформление: ${seasonLabels[season]}`}
      className="mb-5 flex items-center justify-between gap-3 overflow-hidden rounded-3xl border border-blue-100/80 bg-gradient-to-r from-blue-50 via-white to-sky-50 p-3 shadow-sm sm:gap-5 sm:p-4 dark:border-[#304373] dark:from-[#0d1933] dark:via-[#111c3a] dark:to-[#17264b]"
    >
      <div className="min-w-0 pl-1">
        <p className="text-[10px] font-semibold tracking-[0.16em] text-blue-700 uppercase sm:text-xs dark:text-[#9aeeff]">
          Сезонное оформление
        </p>
        <h2 className="mt-1 text-xl font-semibold text-slate-900 sm:text-2xl dark:text-white">
          {seasonLabels[season]}
        </h2>
        <p className="mt-1 text-xs text-slate-600 sm:text-sm dark:text-slate-300">
          Ремонт компьютеров и ноутбуков
        </p>
      </div>
      <div className="relative aspect-[3/2] w-[55%] max-w-60 shrink-0 overflow-hidden rounded-2xl bg-[#f3f7fc] shadow-sm">
        <SeasonalArtwork season={season} />
        {particlePositions.map((position, index) => (
          <ParticleIcon
            key={`${season}-${index}`}
            aria-hidden="true"
            size={12 + (index % 3) * 3}
            className={`pointer-events-none absolute text-blue-700/75 ${particleMotion}`}
            style={{
              left: position.left,
              top: position.top,
              animationDelay: `${position.delay}s`,
            }}
          />
        ))}
      </div>
    </section>
  );
};
