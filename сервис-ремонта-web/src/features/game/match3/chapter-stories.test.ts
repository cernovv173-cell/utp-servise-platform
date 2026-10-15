import { describe, expect, it } from "vitest";

import { getUpcomingChapterStory } from "./chapter-stories";
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
    maximumGamePoints: 40,
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
