import { useQuery } from "@tanstack/react-query";

import { type SeasonalSeasonChoice, getSeasonalTheme } from "@/lib/api";

export const seasonalThemeQueryKey = ["seasonal-theme"] as const;

const seasonPreviewStorageKey = "amazi-season-preview";
const legacyWinterPreviewStorageKey = "amazi-winter-preview";

const seasonalChoices = new Set<SeasonalSeasonChoice>([
  "NONE",
  "SPRING",
  "SUMMER",
  "AUTUMN",
  "WINTER",
]);

const isSeasonalChoice = (value: string | null): value is SeasonalSeasonChoice =>
  value !== null && seasonalChoices.has(value as SeasonalSeasonChoice);

const isPreviewHost = () =>
  typeof window !== "undefined" && window.location.hostname.endsWith(".preview.amazi.pro");

export const getDisplayedSeason = (activeSeason?: SeasonalSeasonChoice): SeasonalSeasonChoice => {
  if (!isPreviewHost()) return activeSeason ?? "NONE";

  const search = new URLSearchParams(window.location.search);
  const requestedSeason = search.get("season-preview");
  if (isSeasonalChoice(requestedSeason)) return requestedSeason;

  const legacyPreview = search.get("winter-preview");
  if (legacyPreview === "1") return "WINTER";
  if (legacyPreview === "0") return activeSeason ?? "NONE";

  try {
    const storedSeason = window.sessionStorage.getItem(seasonPreviewStorageKey);
    if (isSeasonalChoice(storedSeason)) return storedSeason;
    if (window.sessionStorage.getItem(legacyWinterPreviewStorageKey) === "1") return "WINTER";
  } catch {
    // The explicit preview query still works when storage is unavailable.
  }

  return activeSeason ?? "NONE";
};

export const persistSeasonPreviewSetting = () => {
  if (!isPreviewHost()) return;

  const search = new URLSearchParams(window.location.search);
  const requestedSeason = search.get("season-preview");
  const legacyPreview = search.get("winter-preview");
  try {
    if (isSeasonalChoice(requestedSeason)) {
      window.sessionStorage.setItem(seasonPreviewStorageKey, requestedSeason);
      window.sessionStorage.removeItem(legacyWinterPreviewStorageKey);
      return;
    }
    if (legacyPreview === "1") {
      window.sessionStorage.setItem(seasonPreviewStorageKey, "WINTER");
      window.sessionStorage.removeItem(legacyWinterPreviewStorageKey);
    }
    if (legacyPreview === "0") {
      window.sessionStorage.removeItem(seasonPreviewStorageKey);
      window.sessionStorage.removeItem(legacyWinterPreviewStorageKey);
    }
  } catch {
    // The preview remains available for the current URL without storage.
  }
};

export const useSeasonalTheme = () =>
  useQuery({
    queryKey: seasonalThemeQueryKey,
    queryFn: ({ signal }) => getSeasonalTheme(signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
