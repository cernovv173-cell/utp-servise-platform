import { useState } from "react";

import {
  type RaccoonCosmeticId,
  getUnlockedRaccoonCosmetics,
  raccoonCosmetics,
  readSelectedRaccoonCosmetic,
  saveSelectedRaccoonCosmetic,
} from "./raccoon-cosmetics";

export const useRaccoonCosmeticSelection = (userId: string | null, completedCount: number) => {
  const unlocked = getUnlockedRaccoonCosmetics(completedCount);
  const [selection, setSelection] = useState<{
    userId: string;
    cosmeticId: RaccoonCosmeticId;
  } | null>(null);
  const preferredId =
    userId && selection?.userId === userId
      ? selection.cosmeticId
      : userId
        ? readSelectedRaccoonCosmetic(userId)
        : "default";
  const selected = unlocked.find((cosmetic) => cosmetic.id === preferredId) ?? raccoonCosmetics[0]!;

  const select = (cosmeticId: RaccoonCosmeticId) => {
    if (!userId || !unlocked.some((cosmetic) => cosmetic.id === cosmeticId)) return;
    setSelection({ userId, cosmeticId });
    saveSelectedRaccoonCosmetic(userId, cosmeticId);
  };

  return { unlocked, selected, select };
};
