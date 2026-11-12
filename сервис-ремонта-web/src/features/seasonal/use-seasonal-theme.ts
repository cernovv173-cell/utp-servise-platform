import { useQuery } from "@tanstack/react-query";

import { type SeasonalSeasonChoice, getSeasonalTheme } from "@/lib/api";

export const seasonalThemeQueryKey = ["seasonal-theme"] as const;

const winterPreviewStorageKey = "amazi-winter-preview";

export const getDisplayedSeason = (activeSeason?: SeasonalSeasonChoice): SeasonalSeasonChoice => {
  if (typeof window === "undefined" || !window.location.hostname.endsWith(".preview.amazi.pro")) {
    return activeSeason ?? "NONE";
  }

  const previewSetting = new URLSearchParams(window.location.search).get("winter-preview");
  if (previewSetting === "0") return activeSeason ?? "NONE";

  let storedPreview = false;
  try {
    storedPreview = window.sessionStorage.getItem(winterPreviewStorageKey) === "1";
  } catch {
    // The explicit preview query still works when storage is unavailable.
  }

  return previewSetting === "1" || storedPreview ? "WINTER" : (activeSeason ?? "NONE");
};

export const persistWinterPreviewSetting = () => {
  if (typeof window === "undefined" || !window.location.hostname.endsWith(".preview.amazi.pro")) {
    return;
  }

  const previewSetting = new URLSearchParams(window.location.search).get("winter-preview");
  try {
    if (previewSetting === "1") window.sessionStorage.setItem(winterPreviewStorageKey, "1");
    if (previewSetting === "0") window.sessionStorage.removeItem(winterPreviewStorageKey);
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
