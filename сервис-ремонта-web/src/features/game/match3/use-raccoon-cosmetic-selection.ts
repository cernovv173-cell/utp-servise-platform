import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getMatch3CosmeticPreference,
  initializeMatch3CosmeticPreference,
  updateMatch3CosmeticPreference,
} from "./game-api";
import {
  type RaccoonCosmeticId,
  getUnlockedRaccoonCosmetics,
  raccoonCosmetics,
  readSelectedRaccoonCosmetic,
  saveSelectedRaccoonCosmetic,
} from "./raccoon-cosmetics";

export const useRaccoonCosmeticSelection = (
  token: string | null,
  userId: string | null,
  completedCount: number | null,
) => {
  const queryClient = useQueryClient();
  const queryKey = ["match3-cosmetic-preference", userId] as const;
  const unlocked = getUnlockedRaccoonCosmetics(completedCount ?? 0);
  const preference = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const saved = await getMatch3CosmeticPreference(token!, signal);
      if (saved.selectedCosmeticId) {
        saveSelectedRaccoonCosmetic(userId!, saved.selectedCosmeticId);
        return saved.selectedCosmeticId;
      }

      const localChoice = readSelectedRaccoonCosmetic(userId!);
      const initialChoice = unlocked.some((cosmetic) => cosmetic.id === localChoice)
        ? localChoice
        : "default";
      const initialized = await initializeMatch3CosmeticPreference(token!, initialChoice, signal);
      const selectedCosmeticId = initialized.selectedCosmeticId ?? "default";
      saveSelectedRaccoonCosmetic(userId!, selectedCosmeticId);
      return selectedCosmeticId;
    },
    enabled: Boolean(token && userId && completedCount !== null),
    staleTime: 0,
    refetchOnWindowFocus: true,
  });
  const save = useMutation({
    mutationFn: (cosmeticId: RaccoonCosmeticId) =>
      updateMatch3CosmeticPreference(token!, cosmeticId),
    onMutate: () => queryClient.cancelQueries({ queryKey }),
    onSuccess: ({ selectedCosmeticId }) => {
      if (!selectedCosmeticId || !userId) return;
      queryClient.setQueryData(queryKey, selectedCosmeticId);
      saveSelectedRaccoonCosmetic(userId, selectedCosmeticId);
    },
  });

  const preferredId = preference.data ?? (userId ? readSelectedRaccoonCosmetic(userId) : "default");
  const selected = unlocked.find((cosmetic) => cosmetic.id === preferredId) ?? raccoonCosmetics[0]!;
  const select = (cosmeticId: RaccoonCosmeticId) => {
    if (
      !token ||
      !userId ||
      !preference.isSuccess ||
      !unlocked.some((cosmetic) => cosmetic.id === cosmeticId)
    ) {
      return;
    }
    save.mutate(cosmeticId);
  };

  return {
    unlocked,
    selected,
    select,
    isReady: preference.isSuccess,
    isLoading: preference.isPending && preference.isEnabled,
    isSaving: save.isPending,
    loadError: preference.error,
    saveError: save.error,
  };
};
