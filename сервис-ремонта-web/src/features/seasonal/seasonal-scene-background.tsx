import type { CSSProperties } from "react";

import type { SeasonalSeasonChoice } from "@/lib/api";

const backgroundImageBySeason: Record<Exclude<SeasonalSeasonChoice, "NONE">, string> = {
  SPRING: "/images/seasonal-spring.webp",
  SUMMER: "/images/seasonal-summer.webp",
  AUTUMN: "/images/seasonal-autumn.webp",
  WINTER: "/images/seasonal-winter.webp",
};

const snowflakes = Array.from({ length: 60 }, (_, index) => ({
  left: `${(index * 47 + 11) % 100}%`,
  delay: -((index * 13) % 24),
  duration: 14 + ((index * 7) % 14),
  size: 2 + ((index * 17) % 4),
  drift: 12 + ((index * 19) % 48),
  opacity: 0.22 + ((index * 23) % 34) / 100,
}));

const WinterSnowfall = () => (
  <div className="absolute inset-0 overflow-hidden">
    {snowflakes.map((flake, index) => (
      <span
        key={`snowflake-${index}`}
        className="seasonal-snowflake seasonal-snow-fall absolute -top-3 block rounded-full"
        style={
          {
            left: flake.left,
            width: `${flake.size}px`,
            height: `${flake.size}px`,
            opacity: flake.opacity,
            animationDelay: `${flake.delay}s`,
            animationDuration: `${flake.duration}s`,
            "--snow-drift": `${flake.drift}px`,
          } as CSSProperties
        }
      />
    ))}
  </div>
);

export const SeasonalSceneBackground = ({ season }: { season: SeasonalSeasonChoice }) => {
  if (season === "NONE") return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src={backgroundImageBySeason[season]}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        className="absolute inset-0 size-full object-cover object-center opacity-20 transition-opacity duration-700 dark:opacity-15"
      />
      {season === "WINTER" && <WinterSnowfall />}
    </div>
  );
};
