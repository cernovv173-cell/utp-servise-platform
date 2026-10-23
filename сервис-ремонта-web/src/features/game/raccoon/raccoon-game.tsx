import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useAuth } from "@/features/auth/auth-context";

import { RaccoonBoard } from "./raccoon-board";
import { didRaccoonClearCombo } from "./raccoon-combo";
import {
  type RaccoonBooster,
  type RaccoonPosition,
  activateRaccoonMagnet,
  applyRaccoonBooster,
  claimRaccoonGameRewards,
  getRaccoonHint,
  getRaccoonProgress,
  moveRaccoonTile,
  restartRaccoonSession,
  startRaccoonSession,
} from "./raccoon-game-api";
import {
  RaccoonActiveControls,
  RaccoonCampaignComplete,
  RaccoonCampaignPanel,
  RaccoonGameAside,
  RaccoonGameHero,
  RaccoonGamePointsPanel,
  RaccoonSessionOutcome,
  RaccoonSessionStats,
  RaccoonStartLevelPanel,
  panelClass,
} from "./raccoon-game-panels";
import { getRaccoonChapter } from "./raccoon-game-theme";

const adjacent = (first: RaccoonPosition, second: RaccoonPosition) =>
  Math.abs(first.row - second.row) + Math.abs(first.column - second.column) === 1;

export const RaccoonGame = ({ embedded = false }: { embedded?: boolean }) => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<RaccoonPosition | null>(null);
  const [activeBooster, setActiveBooster] = useState<RaccoonBooster | null>(null);
  const [hint, setHint] = useState<{ from: RaccoonPosition; to: RaccoonPosition } | null>(null);
  const [notice, setNotice] = useState("");
  const [celebrating, setCelebrating] = useState(false);
  const comboTimer = useRef<number | null>(null);
  const progressKey = ["raccoon-match3", token, user?.id];
  const progress = useQuery({
    queryKey: progressKey,
    queryFn: ({ signal }) => getRaccoonProgress(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
    retry: false,
  });
  const session = progress.data?.activeSession ?? null;
  const refresh = () => void queryClient.invalidateQueries({ queryKey: progressKey });
  const showError = (error: Error) =>
    setNotice(error.message || "Не удалось связаться с сервером.");
  const triggerComboReaction = () => {
    setCelebrating(true);
    if (comboTimer.current !== null) window.clearTimeout(comboTimer.current);
    comboTimer.current = window.setTimeout(() => {
      setCelebrating(false);
      comboTimer.current = null;
    }, 1400);
  };

  useEffect(
    () => () => {
      if (comboTimer.current !== null) window.clearTimeout(comboTimer.current);
    },
    [],
  );

  const start = useMutation({
    mutationFn: (level?: number) => startRaccoonSession(token!, level),
    onSuccess: () => {
      setSelected(null);
      setActiveBooster(null);
      setHint(null);
      setNotice("");
      refresh();
    },
    onError: showError,
  });
  const restart = useMutation({
    mutationFn: () => {
      if (!session) throw new Error("Игровая сессия не найдена.");
      return restartRaccoonSession(token!, session.id);
    },
    onSuccess: () => {
      setSelected(null);
      setActiveBooster(null);
      setHint(null);
      setNotice("Уровень начат заново. Пройденные этапы и баллы сохранены.");
      refresh();
    },
    onError: showError,
  });
  const move = useMutation({
    mutationFn: ({ from, to }: { from: RaccoonPosition; to: RaccoonPosition }) => {
      if (!session) throw new Error("Сначала начните уровень.");
      return moveRaccoonTile(token!, { sessionId: session.id, from, to });
    },
    onSuccess: (result) => {
      setSelected(null);
      setHint(null);
      const combo =
        result.accepted &&
        session !== null &&
        didRaccoonClearCombo(session.collected, result.session.collected);
      if (combo) triggerComboReaction();
      setNotice(
        !result.accepted
          ? "Этот обмен не собирает ряд. Попробуйте другую пару."
          : result.session.status === "COMPLETE"
            ? "Уровень пройден! Баллы готовы к получению."
            : result.session.status === "FAILED"
              ? "Ходы закончились. Попробуйте ещё раз."
              : combo
                ? "Комбо 4+! Расти помогает восстановить мастерскую."
                : "Комбинация собрана!",
      );
      refresh();
    },
    onError: showError,
  });
  const booster = useMutation({
    mutationFn: (target: RaccoonPosition) => {
      if (!session || !activeBooster) throw new Error("Выберите бустер и клетку.");
      return applyRaccoonBooster(token!, {
        sessionId: session.id,
        booster: activeBooster,
        target,
      });
    },
    onSuccess: (result) => {
      setActiveBooster(null);
      setSelected(null);
      setHint(null);
      setNotice(
        !result.accepted
          ? "Этот бустер сейчас нельзя применить."
          : result.session.status === "COMPLETE"
            ? "Уровень пройден! Баллы готовы к получению."
            : "Бустер применён и не потратил ход.",
      );
      refresh();
    },
    onError: showError,
  });
  const magnet = useMutation({
    mutationFn: () => {
      if (!session) throw new Error("Сначала начните уровень.");
      return activateRaccoonMagnet(token!, session.id);
    },
    onSuccess: (result) => {
      setNotice(
        result.accepted
          ? "Магнитный импульс притянул золотые кристаллы."
          : "Пока нет заряда для магнита.",
      );
      refresh();
    },
    onError: showError,
  });
  const hintRequest = useMutation({
    mutationFn: () => {
      if (!session) throw new Error("Сначала начните уровень.");
      return getRaccoonHint(token!, session.id);
    },
    onSuccess: ({ hint: nextHint }) => {
      setHint(nextHint);
      setNotice(nextHint ? "Подсказка отмечена на поле." : "Подходящий ход не найден.");
    },
    onError: showError,
  });
  const claim = useMutation({
    mutationFn: () => claimRaccoonGameRewards(token!),
    onSuccess: async ({ claimedPoints }) => {
      setNotice(
        claimedPoints ? `Зачислено ${claimedPoints} баллов.` : "Нет новых баллов для получения.",
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: progressKey }),
        queryClient.invalidateQueries({ queryKey: ["loyalty", token] }),
      ]);
    },
    onError: showError,
  });

  const processing =
    start.isPending || restart.isPending || move.isPending || booster.isPending || magnet.isPending;

  const selectTile = (position: RaccoonPosition) => {
    if (!session || session.status !== "ACTIVE" || processing) return;
    if (activeBooster) {
      booster.mutate(position);
      return;
    }
    if (!selected) {
      setSelected(position);
      return;
    }
    if (selected.row === position.row && selected.column === position.column) {
      setSelected(null);
      return;
    }
    if (adjacent(selected, position)) {
      move.mutate({ from: selected, to: position });
      return;
    }
    setSelected(position);
  };

  const swipeTile = (from: RaccoonPosition, to: RaccoonPosition) => {
    if (!session || session.status !== "ACTIVE" || processing) return;
    if (activeBooster) {
      booster.mutate(to);
      return;
    }
    move.mutate({ from, to });
  };

  if (!token || user?.role !== "CUSTOMER") {
    return (
      <section className={`${panelClass} mx-auto max-w-3xl p-6 text-white sm:p-8`}>
        <h1 className="text-2xl font-black">Игра «Ремонтные работы»</h1>
        <p className="mt-3 leading-6 text-slate-300">
          Войдите в аккаунт клиента, чтобы продолжить прохождение и сохранить игровые баллы.
        </p>
        <Link
          to="/login"
          className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-cyan-300 px-5 py-2.5 font-bold text-slate-950 hover:bg-cyan-200"
        >
          Войти в аккаунт
        </Link>
      </section>
    );
  }

  if (progress.isLoading) {
    return (
      <div className={`${panelClass} mx-auto max-w-3xl p-8 text-center text-slate-200`}>
        Загружаем сохранённое прохождение…
      </div>
    );
  }

  if (progress.error || !progress.data) {
    return (
      <section className={`${panelClass} mx-auto max-w-3xl p-6 text-white`}>
        <h1 className="text-xl font-bold">Не удалось открыть игру</h1>
        <p className="mt-2 text-sm text-slate-300">
          {progress.error instanceof Error
            ? progress.error.message
            : "Проверьте подключение и попробуйте ещё раз."}
        </p>
        <button
          type="button"
          onClick={() => void progress.refetch()}
          className="mt-4 min-h-10 rounded-xl bg-cyan-300 px-4 font-bold text-slate-950"
        >
          Повторить
        </button>
      </section>
    );
  }

  const data = progress.data;
  const currentLevel = data.currentLevel;
  const displayLevel = session?.level ?? currentLevel ?? 100;
  const chapter = getRaccoonChapter(displayLevel);

  return (
    <main
      className="relative isolate overflow-hidden rounded-3xl border border-amber-100/25 bg-[#1a120e] text-white shadow-[0_20px_65px_rgba(28,15,8,.38)]"
      style={{
        backgroundImage: `linear-gradient(100deg, rgba(29,17,11,.9), rgba(17,22,27,.74)), url('${chapter.background}')`,
        backgroundPosition: "center",
        backgroundSize: "cover",
      }}
    >
      <div className="grid gap-5 p-4 sm:p-7 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <RaccoonGameHero embedded={embedded} level={displayLevel} celebrating={celebrating} />
          <RaccoonGamePointsPanel
            progress={data}
            claiming={claim.isPending}
            onClaim={() => claim.mutate()}
          />

          {notice && (
            <p
              className="mb-4 rounded-xl border border-cyan-200/20 bg-cyan-950/55 px-4 py-3 text-sm text-cyan-50"
              role="status"
            >
              {notice}
            </p>
          )}

          {!session && currentLevel !== null && (
            <RaccoonStartLevelPanel
              level={currentLevel}
              pointsPerLevel={data.pointsPerLevel}
              disabled={processing}
              onStart={() => start.mutate(currentLevel)}
            />
          )}

          {currentLevel === null && !session && <RaccoonCampaignComplete />}

          {session && (
            <section className="space-y-4" aria-label={`Уровень ${session.level}`}>
              <RaccoonSessionStats session={session} />

              <RaccoonBoard
                board={session.board}
                obstacles={session.obstacles}
                level={session.level}
                electricShift={session.electricShift}
                selected={selected}
                hint={hint}
                activeBooster={activeBooster}
                disabled={session.status !== "ACTIVE" || processing}
                onTileClick={selectTile}
                onSwipe={swipeTile}
              />

              {session.status === "ACTIVE" ? (
                <RaccoonActiveControls
                  session={session}
                  processing={processing}
                  activeBooster={activeBooster}
                  onBoosterToggle={(booster) => {
                    setSelected(null);
                    setActiveBooster((current) => (current === booster ? null : booster));
                  }}
                  onMagnet={() => magnet.mutate()}
                  onHint={() => hintRequest.mutate()}
                />
              ) : (
                <RaccoonSessionOutcome
                  session={session}
                  pointsPerLevel={data.pointsPerLevel}
                  processing={processing}
                  onRestart={() => restart.mutate()}
                  onNextLevel={() => start.mutate(session.level + 1)}
                />
              )}
            </section>
          )}
        </div>

        <aside className="space-y-4">
          <RaccoonGameAside pointsPerLevel={data.pointsPerLevel} />
          <RaccoonCampaignPanel
            progress={data}
            embedded={embedded}
            session={session}
            onChooseLevel={(level) => start.mutate(level)}
          />
        </aside>
      </div>
    </main>
  );
};
