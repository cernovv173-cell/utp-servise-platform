import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Check, Link2, Sparkles } from "lucide-react";
import { useState } from "react";

import { AppShell } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import {
  createDailyChallengeBoard,
  getDailyChallengeDayKey,
  isDailyChallengeComplete,
  isDailyChallengeMatch,
  saveDailyChallengeCompletion,
} from "@/features/game/match3/daily-challenge";
import { GameBoard } from "@/features/game/match3/game-board";

const DailyChallengePage = () => {
  const { user } = useAuth();
  const [dayKey] = useState(getDailyChallengeDayKey);
  const [board] = useState(() => createDailyChallengeBoard(dayKey));
  const [savedCompletion, setSavedCompletion] = useState<{
    userId: string | null;
    dayKey: string | null;
  }>({ userId: null, dayKey: null });
  const [message, setMessage] = useState("");
  const completed = Boolean(
    user?.id &&
    ((savedCompletion.userId === user.id && savedCompletion.dayKey === dayKey) ||
      isDailyChallengeComplete(user.id, dayKey)),
  );

  const onMove = (from: { row: number; column: number }, to: { row: number; column: number }) => {
    if (isDailyChallengeMatch(board, from, to)) {
      setSavedCompletion({ userId: user?.id ?? null, dayKey });
      setMessage("Отличный ход! Новая задача появится завтра.");
      if (user?.id) saveDailyChallengeCompletion(user.id, dayKey);
    } else {
      setMessage("Эта пара не собирает три в ряд. Попробуй другой соседний обмен.");
    }
  };

  return (
    <AppShell active="/game">
      <main className="relative isolate overflow-hidden rounded-3xl border border-cyan-300/20 bg-[#071022] p-4 text-white sm:p-7">
        <div
          className="absolute inset-0 -z-10 bg-cover bg-center opacity-30"
          style={{ backgroundImage: "url('/images/match3-ancient-forest-bg.png')" }}
        />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.18em] text-cyan-200 uppercase">
              <CalendarDays size={15} aria-hidden="true" />
              Испытание дня · {dayKey}
            </p>
            <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Найди удачный обмен</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#d1def8]">
              Выбери две соседние фишки так, чтобы собрать три одинаковые детали в линию. Попытки не
              ограничены.
            </p>
          </div>
          <Link
            to="/game"
            className="inline-flex min-h-10 items-center rounded-xl border border-cyan-200/25 bg-[#101a34] px-4 text-sm font-medium text-cyan-100 transition hover:bg-[#182648] focus-visible:ring-2 focus-visible:ring-cyan-100"
          >
            К основной игре
          </Link>
        </div>

        {user?.role !== "CUSTOMER" ? (
          <p className="mt-6 rounded-2xl bg-[#101a34] p-4">
            Испытание дня доступно аккаунтам клиентов.
          </p>
        ) : (
          <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="rounded-3xl border border-cyan-200/15 bg-[#0b132a]/80 p-3 sm:p-5">
              <div className="mx-auto max-w-[34rem]">
                <GameBoard session={{ board }} disabled={completed} onMove={onMove} />
              </div>
              {message && (
                <p
                  className={`mx-auto mt-4 max-w-[34rem] rounded-xl p-3 text-sm ${completed ? "bg-emerald-300/10 text-emerald-100" : "bg-violet-300/10 text-violet-100"}`}
                  role="status"
                >
                  {message}
                </p>
              )}
            </section>
            <aside className="rounded-3xl border border-[#26365f] bg-[#0b132a]/90 p-5">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-violet-300/10 text-violet-200">
                {completed ? (
                  <Check size={21} aria-hidden="true" />
                ) : (
                  <Sparkles size={21} aria-hidden="true" />
                )}
              </div>
              <h2 className="mt-4 font-semibold">
                {completed ? "Задача решена" : "Одна комбинация — и готово"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-[#a9b8dc]">
                {completed
                  ? "Ты нашёл правильный ход. Завтра енот принесёт новую головоломку."
                  : "Найди любой соседний обмен, после которого появятся три одинаковые детали."}
              </p>
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-cyan-200/15 bg-cyan-300/5 p-3 text-xs leading-5 text-cyan-100">
                <Link2 size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
                Эта головоломка отдельная: она не меняет уровни, очки и награды основной игры.
              </div>
            </aside>
          </div>
        )}
      </main>
    </AppShell>
  );
};

export const Route = createFileRoute("/game/daily")({ component: DailyChallengePage });
