import { Flower2, Leaf, Snowflake, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { SeasonalArtwork } from "@/features/seasonal/seasonal-artwork";

import type { SeasonalSeason, SeasonalSeasonChoice } from "@/lib/api";

const particleIcons = {
  SPRING: Flower2,
  SUMMER: Sparkles,
  AUTUMN: Leaf,
  WINTER: Snowflake,
} satisfies Record<SeasonalSeason, typeof Leaf>;

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

export const SeasonalSceneBackground = ({ season }: { season: SeasonalSeasonChoice }) => {
  const [isRaining, setIsRaining] = useState(false);

  useEffect(() => {
    setIsRaining(false);
    if (season !== "AUTUMN") return;

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
  }, [season]);

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
      {particlePositions.map((position, index) => (
        <ParticleIcon
          key={`${season}-${index}`}
          aria-hidden="true"
          size={16 + (index % 3) * 5}
          className={`absolute text-blue-700/60 dark:text-sky-100/55 ${particleMotion}`}
          style={{
            left: position.left,
            top: position.top,
            animationDelay: `${position.delay}s`,
            animationDuration: `${position.duration}s`,
          }}
        />
      ))}
      {season === "AUTUMN" && isRaining && (
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
      )}
    </div>
  );
};
