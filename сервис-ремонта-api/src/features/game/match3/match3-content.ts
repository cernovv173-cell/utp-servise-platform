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

export const MATCH3_CHAPTERS = [
  {
    number: 1,
    firstLevel: 1,
    lastLevel: 20,
    title: "Корпус",
    setting: "Лес древних пластин",
    description: "Енот собирает металлические пластины для прочного корпуса.",
  },
  {
    number: 2,
    firstLevel: 21,
    lastLevel: 40,
    title: "Материнская плата",
    setting: "Корни-проводники",
    description: "Магические корни соединяются в основу будущего компьютера.",
  },
  {
    number: 3,
    firstLevel: 41,
    lastLevel: 60,
    title: "Процессор",
    setting: "Кристальная чаща",
    description: "Найди и ограни энергетические кристаллы для процессора.",
  },
  {
    number: 4,
    firstLevel: 61,
    lastLevel: 80,
    title: "Система охлаждения",
    setting: "Ледяная поляна",
    description: "Ледяные феи помогут охладить разогретую систему.",
  },
  {
    number: 5,
    firstLevel: 81,
    lastLevel: 100,
    title: "Первый запуск",
    setting: "Мастерская енота",
    description: "Собери оставшиеся детали и настрой компьютер к запуску.",
  },
] as const;

export type Match3PartKey = (typeof MATCH3_PARTS)[number]["key"];
export type Match3Chapter = (typeof MATCH3_CHAPTERS)[number];

export const MATCH3_PART_INDEX = new Map(
  MATCH3_PARTS.map((part, index) => [part.key, index]),
);

export const getMatch3Part = (key: string) =>
  MATCH3_PARTS.find((part) => part.key === key) ?? MATCH3_PARTS[0]!;

export const getMatch3Chapter = (levelNumber: number): Match3Chapter =>
  MATCH3_CHAPTERS.find(
    (chapter) =>
      levelNumber >= chapter.firstLevel && levelNumber <= chapter.lastLevel,
  ) ?? MATCH3_CHAPTERS[MATCH3_CHAPTERS.length - 1]!;

export const getMatch3TargetPart = (levelNumber: number): Match3PartKey => {
  if (levelNumber <= 20) return "case";
  if (levelNumber <= 40) return "motherboard";
  if (levelNumber <= 60) return "processor";
  if (levelNumber <= 80) return "cooling";
  if (levelNumber <= 85) return "gpu";
  if (levelNumber <= 90) return "ssd";
  if (levelNumber <= 95) return "ram";
  return "power";
};

export const getMatch3ObstaclePlan = (levelNumber: number) => ({
  frozen:
    levelNumber < 10 ? 0 : Math.min(8, Math.floor((levelNumber - 6) / 8)),
  junk:
    levelNumber < 21 ? 0 : Math.min(6, Math.floor((levelNumber - 17) / 12)),
  anomalies:
    levelNumber < 41 ? 0 : Math.min(4, Math.floor((levelNumber - 35) / 16)),
});
