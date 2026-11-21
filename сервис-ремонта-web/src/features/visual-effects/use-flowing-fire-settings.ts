import { useQuery } from "@tanstack/react-query";

import { type FlowingFireSettings, getFlowingFireSettings } from "@/lib/api";

export const FLOWING_FIRE_SETTINGS_QUERY_KEY = ["flowing-fire-settings"] as const;

export const DEFAULT_FLOWING_FIRE_SETTINGS: FlowingFireSettings = {
  closure: { enabled: true, palette: "EMBER" },
  giveaway: { enabled: true, palette: "CYAN" },
};

export const useFlowingFireSettings = () =>
  useQuery({
    queryKey: FLOWING_FIRE_SETTINGS_QUERY_KEY,
    queryFn: ({ signal }) => getFlowingFireSettings(signal),
    staleTime: 0,
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
