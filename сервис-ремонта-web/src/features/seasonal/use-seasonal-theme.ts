import { useQuery } from "@tanstack/react-query";

import { getSeasonalTheme } from "@/lib/api";

export const seasonalThemeQueryKey = ["seasonal-theme"] as const;

export const useSeasonalTheme = () =>
  useQuery({
    queryKey: seasonalThemeQueryKey,
    queryFn: ({ signal }) => getSeasonalTheme(signal),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
  });
