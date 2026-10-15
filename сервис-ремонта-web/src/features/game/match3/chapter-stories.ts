import type { Match3Chapter, Match3Progress } from "./game-api";

type ChapterStoryContent = {
  nextChapterNumber: number;
  narration: string;
  raccoonDialogue: string;
};

export type ChapterStory = ChapterStoryContent & {
  nextChapter: Match3Chapter;
};

export type Match3Epilogue = {
  title: string;
  narration: string;
  raccoonDialogue: string;
};

const match3Epilogue: Match3Epilogue = {
  title: "Компьютер ожил!",
  narration:
    "Последняя деталь встаёт на место, и мастерскую озаряет мягкий свет. Енот улыбается: его компьютер собран — от первого корпуса до последнего провода.",
  raccoonDialogue: "Мы сделали это! Спасибо, что помог мне собрать компьютер мечты!",
};

const chapterStoryContent: ChapterStoryContent[] = [
  {
    nextChapterNumber: 2,
    narration:
      "Последняя пластина встаёт на место. Енот проверяет корпус: тот звенит, как маленький колокол, и ни одна деталь не шатается.",
    raccoonDialogue:
      "Теперь нужны дорожки, которые соединят все части. В корнях старого леса спрятана материнская плата!",
  },
  {
    nextChapterNumber: 3,
    narration:
      "Магические корни сплетаются в сеть проводников, и по ним пробегает зелёный свет. В чаще енот находит кристалл, который отвечает на каждый импульс.",
    raccoonDialogue: "Ограню его — и появится сердце компьютера, его процессор!",
  },
  {
    nextChapterNumber: 4,
    narration:
      "Кристалл оживает, освещая всю поляну. Но детали нагрелись от его силы, и металлический корпус уже потрескивает.",
    raccoonDialogue: "Нужно охладить сборку. Ледяные феи, помогите моему компьютеру!",
  },
  {
    nextChapterNumber: 5,
    narration:
      "Ледяные феи укрощают жар, и последние детали занимают свои места в мастерской. Енот включает визор и сверяется с чертежом.",
    raccoonDialogue: "Почти готово. Остался первый запуск — держу лапы крестиком!",
  },
];

export const getUpcomingChapterStory = (
  progress: Match3Progress | undefined,
  seenChapterNumbers: readonly number[],
  hasActiveSession = false,
): ChapterStory | null => {
  if (!progress || progress.currentLevel === null || hasActiveSession) return null;

  const chapters = Array.from(
    new Map(progress.levels.map((level) => [level.chapter.number, level.chapter])).values(),
  ).sort((first, second) => first.number - second.number);
  const nextChapter = chapters.find(
    (chapter) => chapter.number > 1 && chapter.firstLevel === progress.currentLevel,
  );

  if (
    !nextChapter ||
    seenChapterNumbers.includes(nextChapter.number) ||
    progress.activeSession?.status === "ACTIVE"
  ) {
    return null;
  }

  const previousChapter = chapters.find((chapter) => chapter.number === nextChapter.number - 1);
  if (!previousChapter || previousChapter.lastLevel + 1 !== nextChapter.firstLevel) return null;

  const previousChapterLevels = progress.levels.filter(
    (level) =>
      level.chapter.number === previousChapter.number &&
      level.number >= previousChapter.firstLevel &&
      level.number <= previousChapter.lastLevel,
  );
  const expectedLevelCount = previousChapter.lastLevel - previousChapter.firstLevel + 1;

  if (
    previousChapterLevels.length !== expectedLevelCount ||
    previousChapterLevels.some((level) => !level.isCompleted)
  ) {
    return null;
  }

  const story = chapterStoryContent.find((item) => item.nextChapterNumber === nextChapter.number);

  return story ? { ...story, nextChapter } : null;
};

export const getMatch3Epilogue = (progress: Match3Progress | undefined) => {
  if (
    !progress ||
    progress.currentLevel !== null ||
    progress.completedCount !== 100 ||
    progress.levels.length !== 100
  ) {
    return null;
  }

  const finalLevel = progress.levels.find((level) => level.number === 100);
  return finalLevel?.isCompleted && progress.levels.every((level) => level.isCompleted)
    ? match3Epilogue
    : null;
};
