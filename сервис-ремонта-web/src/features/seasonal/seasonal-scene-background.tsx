import { useRouterState } from "@tanstack/react-router";
import { Flower2, Leaf, Snowflake, Sparkles, Sun } from "lucide-react";
import { useEffect, useState } from "react";

import { SeasonalArtwork } from "@/features/seasonal/seasonal-artwork";

import type { SeasonalSeason, SeasonalSeasonChoice } from "@/lib/api";

const particleIcons = {
  SPRING: Flower2,
  SUMMER: Sparkles,
  AUTUMN: Leaf,
  WINTER: Snowflake,
} satisfies Record<SeasonalSeason, typeof Leaf>;

const accentIcons = {
  SPRING: [Flower2, Sparkles, Leaf],
  SUMMER: [Sun, Sparkles, Sun],
  AUTUMN: [Leaf, Sparkles, Leaf],
  WINTER: [Snowflake, Sparkles, Snowflake],
} satisfies Record<SeasonalSeason, (typeof Leaf)[]>;

const particlePositions = [
  { left: "8%", top: "12%", delay: 0, duration: 18 },
  { left: "22%", top: "68%", delay: 1.4, duration: 24 },
  { left: "34%", top: "32%", delay: 2.7, duration: 20 },
  { left: "47%", top: "84%", delay: 0.8, duration: 26 },
  { left: "59%", top: "18%", delay: 3.5, duration: 19 },
  { left: "70%", top: "55%", delay: 2.1, duration: 23 },
  { left: "82%", top: "9%", delay: 4.2, duration: 21 },
  { left: "94%", top: "74%", delay: 1.1, duration: 25 },
];

const accentPositions = [
  { left: "15%", top: "22%", delay: 0.2, size: 24 },
  { left: "76%", top: "34%", delay: 1.1, size: 18 },
  { left: "89%", top: "78%", delay: 2.4, size: 22 },
  { left: "5%", top: "62%", delay: 1.8, size: 16 },
  { left: "52%", top: "8%", delay: 0.8, size: 20 },
];

const snowPositions = Array.from({ length: 110 }, (_, index) => ({
  left: `${(index * 47 + 11) % 100}%`,
  delay: -((index * 13) % 24),
  duration: 5 + ((index * 7) % 11),
  size: 2 + ((index * 17) % 6),
  drift: 24 + ((index * 19) % 115),
  opacity: 0.42 + ((index * 23) % 50) / 100,
}));

const Snowstorm = ({ isNavigating }: { isNavigating: boolean }) => (
  <div className="absolute inset-0 overflow-hidden">
    {snowPositions.map((flake, index) => (
      <span
        key={`snow-${index}`}
        className={`seasonal-snowflake absolute -top-3 block rounded-full ${isNavigating ? "seasonal-blizzard-flake" : "seasonal-snow-fall"}`}
        style={
          {
            left: flake.left,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDelay: `${flake.delay}s`,
            animationDuration: `${flake.duration * (isNavigating ? 0.48 : 1)}s`,
            "--snow-drift": `${flake.drift}px`,
          } as React.CSSProperties
        }
      />
    ))}
  </div>
);

const SeasonalRain = () => {
  const [isRaining, setIsRaining] = useState(false);

  useEffect(() => {
    let rainEndTimeout: number | undefined;
    const startRain = () => {
      setIsRaining(true);
      rainEndTimeout = window.setTimeout(() => setIsRaining(false), 30 * 60 * 1_000);
    };
    const rainInterval = window.setInterval(startRain, 60 * 60 * 1_000);

    return () => {
      window.clearInterval(rainInterval);
      if (rainEndTimeout !== undefined) window.clearTimeout(rainEndTimeout);
    };
  }, []);

  if (!isRaining) return null;

  return (
    <div className="absolute inset-0 overflow-hidden">
      {Array.from({ length: 32 }, (_, index) => (
        <span
          key={`rain-${index}`}
          className="seasonal-rain-drop absolute -top-7 block"
          style={{
            left: `${(index * 37 + 3) % 100}%`,
            animationDuration: `${620 + (index % 7) * 55}ms`,
            animationDelay: `${-(index % 9) * 70}ms`,
          }}
        />
      ))}
    </div>
  );
};

export const SeasonalSceneBackground = ({ season }: { season: SeasonalSeasonChoice }) => {
  const isNavigating = useRouterState({ select: (state) => state.isLoading });

  if (season === "NONE") return null;

  const ParticleIcon = particleIcons[season];
  const particleMotion =
    season === "SUMMER" ? "seasonal-particle seasonal-sparkle" : "seasonal-particle seasonal-drift";

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <SeasonalArtwork
        season={season}
        className="absolute inset-0 opacity-40 transition-opacity duration-700 dark:opacity-30"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-white/45 to-white/60 dark:from-[#070b18]/50 dark:via-[#070b18]/60 dark:to-[#070b18]/75" />
      <div className="seasonal-glow-pulse absolute top-1/4 -left-24 size-72 rounded-full bg-[var(--season-glow)] blur-3xl" />
      <div className="seasonal-sunbeam absolute top-0 -right-28 h-[65vh] w-80 rotate-[-8deg] bg-gradient-to-b from-[var(--season-glow)] to-transparent blur-3xl" />
      {particlePositions.map((position, index) => (
        <ParticleIcon
          key={`${season}-${index}`}
          aria-hidden="true"
          size={16 + (index % 3) * 5}
          className={`absolute text-[var(--season-accent)] opacity-75 dark:opacity-80 ${particleMotion}`}
          style={{
            left: position.left,
            top: position.top,
            animationDelay: `${position.delay}s`,
            animationDuration: `${position.duration}s`,
          }}
        />
      ))}
      {accentPositions.map((position, index) => {
        const AccentIcon = accentIcons[season][index % accentIcons[season].length];
        return (
          <AccentIcon
            key={`accent-${season}-${index}`}
            size={position.size}
            className="seasonal-orbit absolute text-[var(--season-accent)] opacity-55 drop-shadow-sm dark:opacity-70"
            style={{
              left: position.left,
              top: position.top,
              animationDelay: `${position.delay}s`,
            }}
          />
        );
      })}
      {season === "AUTUMN" && <SeasonalRain />}
      {season === "WINTER" && <Snowstorm isNavigating={isNavigating} />}
    </div>
  );
};
