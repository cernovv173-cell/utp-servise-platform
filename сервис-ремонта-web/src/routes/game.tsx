import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { getUpcomingChapterStory } from "@/features/game/match3/chapter-stories";
import { ChapterStoryScene } from "@/features/game/match3/chapter-story-scene";
import {
  type Match3Position,
  type Match3Session,
  getMatch3Progress,
  makeMatch3Move,
  startMatch3Level,
} from "@/features/game/match3/game-api";
import { GameBoard } from "@/features/game/match3/game-board";
import {
  ChapterProgress,
  ComputerBuildProgress,
} from "@/features/game/match3/game-progress-panels";

const GamePage = () => {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const [session, setSession] = useState<Match3Session | null>(null);
  const [notice, setNotice] = useState("");
  const [seenStories, setSeenStories] = useState<{
    userId: string | null;
    chapterNumbers: number[];
  }>({ userId: null, chapterNumbers: [] });
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
  const start = useMutation({
    mutationFn: () => startMatch3Level(token!),
    onSuccess: ({ session: next }) => {
      setSession(next);
      client.setQueryData<Awaited<ReturnType<typeof getMatch3Progress>>>(key, (previous) =>
        previous ? { ...previous, activeSession: next } : previous,
      );
      setNotice("");
      void client.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  const move = useMutation({
    mutationFn: ({ from, to }: { from: Match3Position; to: Match3Position }) =>
      makeMatch3Move(token!, { sessionId: active!.id, from, to }),
    onSuccess: (result) => {
      setSession(result.session);
      client.setQueryData<Awaited<ReturnType<typeof getMatch3Progress>>>(key, (previous) =>
        previous ? { ...previous, activeSession: result.session } : previous,
      );
      setNotice(
        !result.accepted
          ? "Этот обмен не создаёт комбинацию. Попробуйте другую пару."
          : result.session.status === "COMPLETE"
            ? "Уровень пройден! Награда начислена."
            : result.session.status === "FAILED"
              ? "Ходы закончились. Попробуйте ещё раз."
              : result.targetMatched
                ? `Собрано деталей: +${result.targetMatched}`
                : "Комбинация собрана!",
      );
      if (result.session.status !== "ACTIVE") void client.invalidateQueries({ queryKey: key });
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
                  />
                )}
                {!upcomingStory && active?.status === "ACTIVE" && (
                  <div className="mt-5">
                    <GameBoard
                      key={active.id}
                      session={active}
                      disabled={move.isPending}
                      onMove={(from, to) => move.mutate({ from, to })}
                    />
                  </div>
                )}
                {notice && (
                  <p className="mt-4 text-sm text-cyan-100" role="status">
                    {notice}
                  </p>
                )}
                {!upcomingStory &&
                  active?.status !== "ACTIVE" &&
                  progress.data?.currentLevel !== null && (
                    <button
                      type="button"
                      disabled={start.isPending || move.isPending}
                      onClick={() => start.mutate()}
                      className="mt-5 min-h-11 rounded-xl bg-cyan-300 px-5 font-semibold text-[#071022] transition hover:bg-cyan-200 disabled:opacity-50"
                    >
                      {start.isPending
                        ? "Открываем…"
                        : active?.status === "FAILED"
                          ? "Попробовать снова"
                          : "Играть"}
                    </button>
                  )}
                {progress.data && <ChapterProgress progress={progress.data} />}
              </>
            )}
          </div>
          <aside>
            {!upcomingStory && (
              <img
                src="/images/raccoon-computer-mascot.jpg"
                alt="Енот собирает компьютер"
                className="w-full rounded-2xl border border-cyan-300/20 object-cover"
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
