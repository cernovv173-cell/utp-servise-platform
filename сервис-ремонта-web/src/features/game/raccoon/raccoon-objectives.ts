import type { RaccoonObjective } from "./raccoon-game-api";

export const raccoonObjectiveNames: Record<RaccoonObjective, string> = {
  cpu: "Процессор",
  gpu: "Видеокарта",
  ram: "Оперативная память",
  ssd: "SSD",
  board: "Материнская плата",
  fan: "Кулер",
  gold: "Золотой чип",
  crate: "Ящик",
  circuit: "Цепь",
};
