import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { getMatch3Epilogue, getUpcomingChapterStory } from "@/features/game/match3/chapter-stories";
import { ChapterStoryScene } from "@/features/game/match3/chapter-story-scene";
import {
  type Match3BoosterKey,
  type Match3Hint,
  type Match3Position,
  type Match3Session,
  applyMatch3Booster,
  claimMatch3Rewards,
  craftMatch3Booster,
  getMatch3Hint,
  getMatch3Progress,
  makeMatch3Move,
  restartMatch3Level,
  startMatch3Level,
} from "@/features/game/match3/game-api";
import { GameBoard } from "@/features/game/match3/game-board";
import { GameEconomyPanel } from "@/features/game/match3/game-economy-panel";
import { GameEpilogueScene } from "@/features/game/match3/game-epilogue-scene";
import {
  ChapterProgress,
  ComputerBuildProgress,
} from "@/features/game/match3/game-progress-panels";
import { GameTutorial, type GameTutorialStep } from "@/features/game/match3/game-tutorial";
import { useRaccoonCosmeticSelection } from "@/features/game/match3/use-raccoon-cosmetic-selection";
import { useRaccoonVoice } from "@/features/game/match3/use-raccoon-voice";

const tutorialStorageKey = (userId: string) => `match3:first-tutorial-seen:v1:${userId}`;

const readTutorialSeen = (userId: string) => {
  try {
    return window.localStorage.getItem(tutorialStorageKey(userId)) === "true";
  } catch {
    return false;
  }
};

const GamePage = () => {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const [session, setSession] = useState<Match3Session | null>(null);
  const [selectedBooster, setSelectedBooster] = useState<Match3BoosterKey | null>(null);
  const [hint, setHint] = useState<Match3Hint | null>(null);
  const [notice, setNotice] = useState("");
  const [seenStories, setSeenStories] = useState<{
    userId: string | null;
    chapterNumbers: number[];
  }>({ userId: null, chapterNumbers: [] });
  const [tutorialProgress, setTutorialProgress] = useState<{
    userId: string | null;
    step: GameTutorialStep;
  }>({ userId: null, step: 0 });
  const [tutorialSeenState, setTutorialSeenState] = useState<{
    userId: string | null;
    seen: boolean;
  }>({ userId: null, seen: false });
  const key = ["match3-progress", token];
  const progress = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => getMatch3Progress(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
  });
  const active =
    (session?.status !== "ACTIVE" && progress.data?.currentLevel !== session?.level.number
      ? null
      : session) ??
    progress.data?.activeSession ??
    null;
  const storyUserId = user?.id ?? null;
  const seenChapterNumbers = seenStories.userId === storyUserId ? seenStories.chapterNumbers : [];
  const upcomingStory = getUpcomingChapterStory(
    progress.data,
    seenChapterNumbers,
    active?.status === "ACTIVE",
  );
  const raccoonVoice = useRaccoonVoice(upcomingStory?.raccoonDialogue ?? null);
  const epilogue = getMatch3Epilogue(progress.data);
  const cosmetics = useRaccoonCosmeticSelection(
    token,
    user?.id ?? null,
    progress.data?.completedCount ?? null,
  );
  const tutorialSeen = user
    ? tutorialSeenState.userId === user.id
      ? tutorialSeenState.seen
      : readTutorialSeen(user.id)
    : true;
  const tutorialStep = tutorialProgress.userId === user?.id ? tutorialProgress.step : 0;
  const tutorialVisible = Boolean(
    user?.role === "CUSTOMER" &&
    !tutorialSeen &&
    ((active?.level.number === 1 && progress.data?.completedCount === 0) || tutorialStep === 1),
  );
  const finishTutorial = () => {
    if (!user) return;
    try {
      window.localStorage.setItem(tutorialStorageKey(user.id), "true");
    } catch {
      // The tutorial can still be dismissed for this visit if storage is unavailable.
    }
    setTutorialSeenState({ userId: user.id, seen: true });
  };
  const markStorySeen = (chapterNumber: number) => {
    const current = seenStories.userId === storyUserId ? seenStories.chapterNumbers : [];
    if (!current.includes(chapterNumber)) {
      setSeenStories({ userId: storyUserId, chapterNumbers: [...current, chapterNumber] });
    }
  };
  const onError = (error: Error) => {
    setNotice(error.message);
    void client.invalidateQueries({ queryKey: key });
  };
  const hintRequest = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("Сначала начните уровень.");
      return getMatch3Hint(token!, active.id);
    },
    onSuccess: ({ hint: nextHint }) => {
      setHint(nextHint);
      setNotice(
        nextHint
          ? "Поменяйте местами две подсвеченные фишки. Подсказка не расходует ход."
          : "Подходящий ход не найден. Попробуйте перезапустить уровень.",
      );
    },
    onError,
  });
  const start = useMutation({
    mutationFn: () => startMatch3Level(token!),
    onSuccess: ({ session: next }) => {
      setSession(next);
      setHint(null);
      client.setQueryData<Awaited<ReturnType<typeof getMatch3Progress>>>(key, (previous) =>
        previous ? { ...previous, activeSession: next } : previous,
      );
      setNotice("");
      void client.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  const restart = useMutation({
    mutationFn: () => {
      if (!active) throw new Error("Нет уровня для перезапуска.");
      return restartMatch3Level(token!, active.id);
    },
    onSuccess: ({ session: next }) => {
      setSession(next);
      setHint(null);
      setSelectedBooster(null);
      client.setQueryData<Awaited<ReturnType<typeof getMatch3Progress>>>(key, (previous) =>
        previous ? { ...previous, activeSession: next } : previous,
      );
      setNotice("Уровень начат заново. Пройденные этапы, баллы и бустеры сохранены.");
      void client.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  const move = useMutation({
    mutationFn: ({ from, to }: { from: Match3Position; to: Match3Position }) =>
      makeMatch3Move(token!, { sessionId: active!.id, from, to }),
    onSuccess: (result) => {
      setSession(result.session);
      if (result.accepted) setHint(null);
      client.setQueryData<Awaited<ReturnType<typeof getMatch3Progress>>>(key, (previous) =>
        previous ? { ...previous, activeSession: result.session } : previous,
      );
      const tutorialMoveAccepted = tutorialVisible && tutorialStep === 0 && result.accepted;
      if (tutorialMoveAccepted && user) {
        setTutorialProgress({ userId: user.id, step: 1 });
      }
      setNotice(
        tutorialMoveAccepted
          ? "Получилось! Вот как работают препятствия — потом можно продолжать игру."
          : !result.accepted
            ? "Этот обмен не создаёт комбинацию. Попробуйте другую пару."
            : result.session.status === "COMPLETE"
              ? `Уровень пройден! Баллы готовы к получению кнопкой ниже.${result.boosterAwarded ? ` Подарок: ${result.boosterAwarded === "row_rocket" ? "🚀 Ракета" : "💥 Импульсная бомба"}.` : ""}`
              : result.session.status === "FAILED"
                ? "Ходы закончились. Попробуйте ещё раз."
                : result.targetMatched
                  ? `Собрано деталей: +${result.targetMatched}`
                  : "Комбинация собрана!",
      );
      if (result.accepted) void client.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  const claim = useMutation({
    mutationFn: () => claimMatch3Rewards(token!),
    onSuccess: ({ claimedLevels, claimedPoints }) => {
      setNotice(
        claimedPoints > 0
          ? `Зачислено ${claimedPoints} баллов за ${claimedLevels} пройденных уровней.`
          : "Нет новых баллов для получения.",
      );
      void client.invalidateQueries({ queryKey: key });
      void client.invalidateQueries({ queryKey: ["loyalty", token] });
    },
    onError,
  });
  const craft = useMutation({
    mutationFn: (boosterId: Match3BoosterKey) => craftMatch3Booster(token!, boosterId),
    onSuccess: ({ boosterId }) => {
      setNotice(
        `Бустер собран: ${boosterId === "row_rocket" ? "🚀 Ракета" : "💥 Импульсная бомба"}.`,
      );
      void client.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  const useBooster = useMutation({
    mutationFn: ({ boosterId, target }: { boosterId: Match3BoosterKey; target: Match3Position }) =>
      applyMatch3Booster(token!, {
        sessionId: active!.id,
        boosterId,
        row: target.row,
        column: target.column,
      }),
    onSuccess: (result) => {
      setSession(result.session);
      setSelectedBooster(null);
      setHint(null);
      setNotice(
        result.session.status === "COMPLETE"
          ? `Уровень пройден бустером! Баллы доступны для получения.${result.boosterAwarded ? ` Подарок: ${result.boosterAwarded === "row_rocket" ? "🚀 Ракета" : "💥 Импульсная бомба"}.` : ""}`
          : "Бустер применён: он очистил клетки поля и потратил один ход.",
      );
      void client.invalidateQueries({ queryKey: key });
    },
    onError,
  });

  return (
    <AppShell active="/game">
      <div className="relative isolate overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#071022] text-white">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-35"
          style={{ backgroundImage: "url('/images/match3-ancient-forest-bg.png')" }}
        />
        <div className="grid gap-6 p-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-cyan-200 uppercase">
              Помоги еноту собрать компьютер
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Три в ряд</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d1def8]">
              Выберите две соседние фишки. Собирайте три одинаковые детали в ряд, чтобы пройти этап.
              Застывшие клетки и мусор исчезают от комбинаций рядом с ними.
            </p>
            <nav aria-label="Дополнительные режимы игры" className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/game/daily"
                className="min-h-10 rounded-xl border border-cyan-200/25 bg-[#101a34]/90 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-[#182648] focus-visible:ring-2 focus-visible:ring-cyan-100"
              >
                Задача дня
              </Link>
              <Link
                to="/game/garage"
                className="min-h-10 rounded-xl border border-violet-200/25 bg-[#101a34]/90 px-4 py-2 text-sm font-medium text-violet-100 transition hover:bg-[#182648] focus-visible:ring-2 focus-visible:ring-violet-100"
              >
                Мастерская · {cosmetics.unlocked.length} образов
              </Link>
            </nav>
            {user?.role !== "CUSTOMER" ? (
              <p className="mt-6 rounded-xl bg-[#101a34] p-4">Игра доступна аккаунтам клиентов.</p>
            ) : progress.isPending ? (
              <p className="mt-6" role="status">
                Загружаем игру…
              </p>
            ) : progress.isError ? (
              <div className="mt-6 rounded-xl bg-[#101a34] p-4" role="alert">
                <p>Не удалось загрузить игру: {progress.error.message}</p>
                <button
                  className="mt-3 text-cyan-200 underline"
                  onClick={() => void progress.refetch()}
                >
                  Повторить
                </button>
              </div>
            ) : (
              <>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="rounded-xl border border-cyan-300/25 bg-[#101a34]/90 px-4 py-2 text-sm">
                    {active
                      ? `Уровень ${active.level.number} · ${active.level.title}`
                      : progress.data?.currentLevel
                        ? `Следующий уровень: ${progress.data.currentLevel}`
                        : "Все уровни пройдены"}
                  </div>
                  {active && (
                    <div className="rounded-xl border border-cyan-300/25 bg-[#101a34]/90 px-4 py-2 text-sm">
                      {active.level.targetPartIcon} {active.level.targetPartName}:{" "}
                      {active.targetCollected}/{active.level.targetCount}
                      <span className="ml-3">
                        Ходы: {active.movesUsed}/{active.level.moveLimit}
                      </span>
                    </div>
                  )}
                </div>
                {upcomingStory && (
                  <ChapterStoryScene
                    story={upcomingStory}
                    onContinue={() => markStorySeen(upcomingStory.nextChapter.number)}
                    voiceEnabled={raccoonVoice.enabled}
                    voiceSupported={raccoonVoice.supported}
                    onToggleVoice={raccoonVoice.toggle}
                    onReplayVoice={raccoonVoice.replay}
                  />
                )}
                {epilogue && <GameEpilogueScene epilogue={epilogue} />}
                {tutorialVisible && (
                  <GameTutorial
                    step={tutorialStep}
                    onSkip={finishTutorial}
                    onContinue={finishTutorial}
                  />
                )}
                {!upcomingStory && !epilogue && active?.status === "ACTIVE" && (
                  <div className="mt-5">
                    <div className="mb-3 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        aria-label="Показать подсказку следующего хода"
                        disabled={
                          hintRequest.isPending ||
                          move.isPending ||
                          useBooster.isPending ||
                          restart.isPending ||
                          tutorialVisible
                        }
                        onClick={() => hintRequest.mutate()}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-amber-200/35 bg-amber-200/10 px-3 text-sm font-semibold text-amber-100 transition hover:bg-amber-200/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <span className="grid size-7 place-items-center rounded-full border border-amber-200/50 font-bold">
                          ?
                        </span>
                        {hintRequest.isPending ? "Ищем ход…" : "Подсказка"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          restart.isPending ||
                          move.isPending ||
                          useBooster.isPending ||
                          tutorialVisible
                        }
                        onClick={() => restart.mutate()}
                        className="min-h-10 rounded-xl border border-rose-200/30 bg-rose-200/10 px-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-200/20 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {restart.isPending ? "Перезапускаем…" : "Начать заново"}
                      </button>
                    </div>
                    <GameBoard
                      key={active.id}
                      session={active}
                      disabled={
                        move.isPending ||
                        useBooster.isPending ||
                        restart.isPending ||
                        (tutorialVisible && tutorialStep === 1)
                      }
                      onMove={(from, to) => move.mutate({ from, to })}
                      boosterSelected={selectedBooster !== null}
                      onBoosterTarget={(target) => {
                        if (selectedBooster)
                          useBooster.mutate({ boosterId: selectedBooster, target });
                      }}
                      hint={hint}
                    />
                  </div>
                )}
                {notice && (
                  <p className="mt-4 text-sm text-cyan-100" role="status">
                    {notice}
                  </p>
                )}
                {progress.data && (
                  <GameEconomyPanel
                    progress={progress.data}
                    selectedBooster={selectedBooster}
                    canUseBoosters={Boolean(
                      active?.status === "ACTIVE" &&
                      !upcomingStory &&
                      !epilogue &&
                      !tutorialVisible &&
                      !restart.isPending,
                    )}
                    isClaiming={claim.isPending}
                    craftingBooster={craft.isPending ? craft.variables : null}
                    onClaim={() => claim.mutate()}
                    onCraft={(boosterId) => craft.mutate(boosterId)}
                    onSelectBooster={setSelectedBooster}
                  />
                )}
                {!upcomingStory &&
                  !epilogue &&
                  active?.status !== "ACTIVE" &&
                  progress.data?.currentLevel !== null && (
                    <button
                      type="button"
                      disabled={start.isPending || move.isPending || restart.isPending}
                      onClick={() => start.mutate()}
                      className="mt-5 min-h-11 rounded-xl bg-cyan-300 px-5 font-semibold text-[#071022] transition hover:bg-cyan-200 disabled:opacity-50"
                    >
                      {start.isPending
                        ? "Открываем…"
                        : active?.status === "FAILED"
                          ? "Начать заново"
                          : "Играть"}
                    </button>
                  )}
                {progress.data && <ChapterProgress progress={progress.data} />}
              </>
            )}
          </div>
          <aside>
            {!upcomingStory && !epilogue && (
              <img
                key={`${active?.id ?? "idle"}:${active?.movesUsed ?? 0}`}
                src={cosmetics.selected.image}
                alt={`Енот в образе «${cosmetics.selected.name}» собирает компьютер`}
                className={`w-full rounded-2xl border border-cyan-300/20 object-cover ${active?.movesUsed ? "game-raccoon-react" : ""}`}
              />
            )}
            {progress.data && (
              <div className="mt-4">
                <ComputerBuildProgress completedCount={progress.data.completedCount} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </AppShell>
  );
};

export const Route = createFileRoute("/game")({ component: GamePage });
