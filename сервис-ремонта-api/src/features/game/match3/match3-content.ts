export const MATCH3_GAME_TITLE = "Помоги еноту собрать компьютер";
export const MATCH3_LEVEL_COUNT = 100;
export const MATCH3_POINTS_PER_LEVEL = 10;
export const MATCH3_TOTAL_POINTS = MATCH3_LEVEL_COUNT * MATCH3_POINTS_PER_LEVEL;

export const MATCH3_PARTS = [
  { key: "processor", name: "Процессор", icon: "🧠" },
  { key: "ram", name: "Оперативная память", icon: "🧩" },
  { key: "ssd", name: "SSD-накопитель", icon: "💽" },
  { key: "cooling", name: "Система охлаждения", icon: "🌀" },
  { key: "gpu", name: "Видеокарта", icon: "🎮" },
  { key: "motherboard", name: "Материнская плата", icon: "🟩" },
  { key: "power", name: "Блок питания", icon: "⚡" },
  { key: "case", name: "Корпус", icon: "🖥️" },
] as const;

export const MATCH3_PART_INDEX = new Map(
  MATCH3_PARTS.map((part, index) => [part.key, index]),
);

export const getMatch3Part = (key: string) =>
  MATCH3_PARTS.find((part) => part.key === key) ?? MATCH3_PARTS[0]!;
