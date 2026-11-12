import type { SeasonalSeasonChoice } from "@/lib/api";

const artworkBySeason: Record<Exclude<SeasonalSeasonChoice, "NONE">, string> = {
  SPRING: "/images/seasonal-spring-banner.webp",
  SUMMER: "/images/seasonal-summer-banner.webp",
  AUTUMN: "/images/seasonal-autumn-banner.webp",
  WINTER: "/images/new-year-raccoon.webp",
};

export const SeasonalArtwork = ({
  season,
  className = "",
}: {
  season: SeasonalSeasonChoice;
  className?: string;
}) => {
  if (season === "NONE") return null;

  return (
    <img
      src={artworkBySeason[season]}
      alt=""
      aria-hidden="true"
      loading="eager"
      decoding="async"
      className={`block h-full w-full bg-[#f3f7fc] object-cover object-[68%_center] ${className}`}
    />
  );
};
