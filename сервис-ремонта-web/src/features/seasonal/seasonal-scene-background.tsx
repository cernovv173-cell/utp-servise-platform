import type { CSSProperties } from "react";

import type { SeasonalSeasonChoice } from "@/lib/api";

const mascotImageBySeason: Record<Exclude<SeasonalSeasonChoice, "NONE">, string> = {
  SPRING: "/images/seasonal-mascot-spring.webp",
  SUMMER: "/images/seasonal-mascot-summer.webp",
  AUTUMN: "/images/seasonal-mascot-autumn.webp",
  WINTER: "/images/seasonal-mascot-winter.webp",
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
        src={mascotImageBySeason[season]}
        alt=""
        aria-hidden="true"
        loading="eager"
        decoding="async"
        className="absolute right-0 bottom-0 h-[58dvh] max-h-[680px] w-[min(36vw,440px)] object-contain object-right-bottom opacity-20 transition-opacity duration-700 max-[600px]:h-[48dvh] max-[600px]:w-[60vw] max-[600px]:opacity-15 dark:opacity-30 max-[600px]:dark:opacity-22"
      />
      {season === "WINTER" && <WinterSnowfall />}
    </div>
  );
};
