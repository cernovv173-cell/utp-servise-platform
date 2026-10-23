import type { RaccoonCounts } from "./raccoon-game-api";

const collectibleParts = ["cpu", "gpu", "ram", "ssd", "board", "fan", "gold"] as const;

export const didRaccoonClearCombo = (before: RaccoonCounts, after: RaccoonCounts) =>
  collectibleParts.reduce(
    (total, part) => total + Math.max(0, (after[part] ?? 0) - (before[part] ?? 0)),
    0,
  ) >= 4;
