import type { Match3PartKey } from "./match3-content.js";

export type Match3BoosterKey = "row_rocket" | "pulse_bomb";

export const MATCH3_BOOSTERS: Record<
  Match3BoosterKey,
  {
    name: string;
    icon: string;
    description: string;
    recipe: Partial<Record<Match3PartKey, number>>;
  }
> = {
  row_rocket: {
    name: "Ракета",
    icon: "🚀",
    description: "Очищает выбранный ряд.",
    recipe: { processor: 2, gpu: 2, power: 1 },
  },
  pulse_bomb: {
    name: "Импульсная бомба",
    icon: "💥",
    description: "Очищает область 3 × 3 вокруг выбранной клетки.",
    recipe: { ram: 2, ssd: 2, cooling: 1, case: 1 },
  },
};

export const MATCH3_BOOSTER_KEYS = Object.keys(
  MATCH3_BOOSTERS,
) as Match3BoosterKey[];

export const isMatch3BoosterKey = (key: string): key is Match3BoosterKey =>
  Object.hasOwn(MATCH3_BOOSTERS, key);

export const partInventoryKey = (key: Match3PartKey) => `part:${key}`;
export const boosterInventoryKey = (key: Match3BoosterKey) => `booster:${key}`;

export const giftForCompletedLevel = (levelNumber: number): Match3BoosterKey =>
  levelNumber % 2 === 0 ? "pulse_bomb" : "row_rocket";
