import { describe, expect, it } from "vitest";

import { getMatch3Epilogue, getUpcomingChapterStory } from "./chapter-stories";
import type { Match3Chapter, Match3Progress } from "./game-api";

const firstChapter: Match3Chapter = {
  number: 1,
  firstLevel: 1,
  lastLevel: 2,
  title: "Корпус",
  setting: "Лес древних пластин",
  description: "Сборка корпуса.",
};

const secondChapter: Match3Chapter = {
  number: 2,
  firstLevel: 3,
  lastLevel: 4,
  title: "Материнская плата",
  setting: "Корни-проводники",
  description: "Сборка платы.",
};

const emptyInventory = {
  parts: {
    processor: 0,
    ram: 0,
    ssd: 0,
    cooling: 0,
    gpu: 0,
    motherboard: 0,
    power: 0,
    case: 0,
  },
  boosters: { row_rocket: 0, pulse_bomb: 0 },
};

const boosterCatalog = [
  {
    id: "row_rocket" as const,
    name: "Ракета",
    icon: "🚀",
    description: "Очищает ряд.",
    recipe: [
      { part: "processor" as const, name: "Процессор", icon: "🧠", quantity: 2 },
      { part: "gpu" as const, name: "Видеокарта", icon: "🎮", quantity: 2 },
      { part: "power" as const, name: "Блок питания", icon: "⚡", quantity: 1 },
    ],
  },
  {
    id: "pulse_bomb" as const,
    name: "Импульсная бомба",
    icon: "💥",
    description: "Очищает область 3 × 3.",
    recipe: [
      { part: "ram" as const, name: "Память", icon: "🧩", quantity: 2 },
      { part: "ssd" as const, name: "SSD", icon: "💽", quantity: 2 },
      { part: "cooling" as const, name: "Охлаждение", icon: "🌀", quantity: 1 },
      { part: "case" as const, name: "Корпус", icon: "🖥️", quantity: 1 },
    ],
  },
];

const makeProgress = (
  options: {
    currentLevel?: number | null;
    completedLevels?: number[];
  } = {},
): Match3Progress => {
  const completedLevels = options.completedLevels ?? [1, 2];
  const levels = [1, 2, 3, 4].map((number) => ({
    id: `level-${number}`,
    number,
    title: `Уровень ${number}`,
    targetPart: "case" as const,
    targetPartName: "Корпус",
    targetPartIcon: "🖥️",
    targetCount: 1,
    moveLimit: 10,
    chapter: number <= firstChapter.lastLevel ? firstChapter : secondChapter,
    isCompleted: completedLevels.includes(number),
    isUnlocked: number <= 3,
    pointsAwarded: completedLevels.includes(number) ? 10 : 0,
  }));

  return {
    levels,
    completedCount: completedLevels.length,
    currentLevel: options.currentLevel === undefined ? 3 : options.currentLevel,
    totalGamePoints: completedLevels.length * 10,
    pendingGamePoints: 0,
    maximumGamePoints: 40,
    inventory: emptyInventory,
    boosterCatalog,
    activeSession: null,
  };
};

const makeCompletedProgress = (completedCount = 100): Match3Progress => {
  const chapterTitles = [
    "Корпус",
    "Материнская плата",
    "Процессор",
    "Система охлаждения",
    "Первый запуск",
  ];
  const levels = Array.from({ length: 100 }, (_, index) => {
    const number = index + 1;
    const chapterNumber = Math.ceil(number / 20);
    const firstLevel = (chapterNumber - 1) * 20 + 1;
    const chapter: Match3Chapter = {
      number: chapterNumber,
      firstLevel,
      lastLevel: chapterNumber * 20,
      title: chapterTitles[chapterNumber - 1]!,
      setting: "Лес",
      description: "Сборка компьютера.",
    };

    return {
      ...makeProgress().levels[0]!,
      id: `level-${number}`,
      number,
      chapter,
      isCompleted: number <= completedCount,
      isUnlocked: number <= completedCount + 1,
      pointsAwarded: number <= completedCount ? 10 : 0,
    };
  });

  return {
    levels,
    completedCount,
    currentLevel: completedCount === 100 ? null : completedCount + 1,
    totalGamePoints: completedCount * 10,
    pendingGamePoints: 0,
    maximumGamePoints: 1000,
    inventory: emptyInventory,
    boosterCatalog,
    activeSession: null,
  };
};

describe("getUpcomingChapterStory", () => {
  it("shows the scene for the next chapter after the previous chapter is complete", () => {
    const story = getUpcomingChapterStory(makeProgress(), []);

    expect(story?.nextChapter.number).toBe(2);
    expect(story?.nextChapter.title).toBe("Материнская плата");
  });

  it("does not interrupt a level already in progress", () => {
    expect(getUpcomingChapterStory(makeProgress(), [], true)).toBeNull();
  });

  it("requires every level in the previous chapter to be complete", () => {
    expect(getUpcomingChapterStory(makeProgress({ completedLevels: [1] }), [])).toBeNull();
  });

  it("only shows at the first level of the next chapter and only once", () => {
    expect(getUpcomingChapterStory(makeProgress({ currentLevel: 4 }), [])).toBeNull();
    expect(getUpcomingChapterStory(makeProgress(), [2])).toBeNull();
  });
});

describe("getMatch3Epilogue", () => {
  it("returns the ending only after all 100 levels, including level 100, are complete", () => {
    const progress = makeCompletedProgress();

    expect(getMatch3Epilogue(progress)?.title).toBe("Компьютер ожил!");
    expect(progress.completedCount).toBe(100);
    expect(progress.levels[99]?.isCompleted).toBe(true);
  });

  it("does not show the ending while the last level or any previous level is incomplete", () => {
    expect(getMatch3Epilogue(makeCompletedProgress(99))).toBeNull();

    const missingLevel = makeCompletedProgress();
    missingLevel.levels[50]!.isCompleted = false;
    expect(getMatch3Epilogue(missingLevel)).toBeNull();
  });
});
