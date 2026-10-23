import { Link as RouterLink } from "@tanstack/react-router";
import { Bomb, ChevronRight, Hammer, Lightbulb, Rocket, Sparkles, Trophy } from "lucide-react";

import type { RaccoonBooster, RaccoonProgress, RaccoonSession } from "./raccoon-game-api";
import { RaccoonLevelMap } from "./raccoon-level-map";
import { raccoonObjectiveNames } from "./raccoon-objectives";
import { RaccoonPartIcon } from "./raccoon-part-icon";

export const panelClass =
  "rounded-2xl border border-white/10 bg-slate-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,.06)] backdrop-blur";

const boosterOptions: {
  id: RaccoonBooster;
  name: string;
  description: string;
  Icon: typeof Hammer;
}[] = [
  { id: "hammer", name: "Молот", description: "Уберите одну деталь", Icon: Hammer },
  { id: "rocket", name: "Ракета", description: "Очистите ряд и столбец", Icon: Rocket },
  { id: "bomb", name: "Бомба", description: "Очистите область 3×3", Icon: Bomb },
];

const chapterName = (level: number) =>
  ["Верстак", "Склад деталей", "Электрощитовая", "Вентиляция", "Главный сервер"][
    Math.min(4, Math.floor((level - 1) / 20))
  ];

export const RaccoonGameHero = ({ embedded }: { embedded: boolean }) => (
  <header className="mb-5 flex items-center gap-4 rounded-2xl border border-cyan-100/15 bg-slate-950/50 p-3 sm:p-4">
    <img
      src="/assets/raccoon-engineer-elite.png"
      alt="Енот-инженер Расти"
      className="h-20 w-20 shrink-0 object-contain sm:h-28 sm:w-28"
    />
    <div className="min-w-0">
      <p className="text-xs font-extrabold tracking-[.18em] text-cyan-200 uppercase">
        Помоги еноту собрать компьютер
      </p>
      <h1 className="mt-1 text-2xl font-black sm:text-3xl">Три в ряд</h1>
      <p className="mt-2 max-w-2xl text-sm leading-5 text-slate-200">
        Меняйте соседние детали местами, собирайте три в ряд и помогите Расти пройти пять глав
        мастерской.
      </p>
      {!embedded && (
        <RouterLink
          to="/game/daily"
          className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-cyan-200 hover:text-white"
        >
          Ежедневное испытание <ChevronRight size={16} aria-hidden="true" />
        </RouterLink>
      )}
    </div>
  </header>
);

export const RaccoonGamePointsPanel = ({
  progress,
  claiming,
  onClaim,
}: {
  progress: RaccoonProgress;
  claiming: boolean;
  onClaim: () => void;
}) => {
  const canClaim = progress.pendingGamePoints > 0;
  return (
    <section
      className={`${panelClass} mb-5 flex flex-wrap items-center justify-between gap-3 p-4`}
      aria-label="Баллы за игру"
    >
      <div>
        <p className="text-xs font-bold tracking-wider text-cyan-200 uppercase">Игровые баллы</p>
        <p className="mt-1 text-sm text-slate-200">
          Всего заработано: <strong className="text-white">{progress.totalGamePoints}</strong> из{" "}
          {progress.maximumGamePoints}
        </p>
        <p className="text-sm text-slate-300">
          Ожидают получения:{" "}
          <strong className="text-amber-200">{progress.pendingGamePoints}</strong>
        </p>
      </div>
      <button
        type="button"
        onClick={onClaim}
        disabled={!canClaim || claiming}
        className="min-h-11 rounded-xl bg-amber-300 px-4 py-2 font-extrabold text-amber-950 transition hover:bg-amber-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {claiming ? "Зачисляем…" : canClaim ? "Получить баллы" : "Нет баллов к получению"}
      </button>
    </section>
  );
};

export const RaccoonStartLevelPanel = ({
  level,
  pointsPerLevel,
  disabled,
  onStart,
}: {
  level: number;
  pointsPerLevel: number;
  disabled: boolean;
  onStart: () => void;
}) => (
  <section className={`${panelClass} mb-5 flex flex-wrap items-center justify-between gap-3 p-4`}>
    <div>
      <p className="font-bold text-white">Продолжайте кампанию</p>
      <p className="mt-1 text-sm text-slate-300">
        Открыт уровень {level} · за первое прохождение начисляется {pointsPerLevel} баллов.
      </p>
    </div>
    <button
      type="button"
      onClick={onStart}
      disabled={disabled}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2 font-extrabold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
    >
      Начать уровень {level} <ChevronRight size={18} aria-hidden="true" />
    </button>
  </section>
);

export const RaccoonCampaignComplete = () => (
  <section className={`${panelClass} mb-5 flex items-center gap-3 p-4 text-emerald-100`}>
    <Trophy aria-hidden="true" />
    <p className="font-bold">Кампания из 100 уровней пройдена!</p>
  </section>
);

export const RaccoonSessionStats = ({ session }: { session: RaccoonSession }) => {
  const goals = session.goals;
  const completedGoals = Object.entries(goals).filter(
    ([key, amount]) =>
      (session.collected[key as keyof typeof session.collected] ?? 0) >= (amount ?? 0),
  ).length;

  return (
    <div className="grid grid-cols-[.75fr_1.8fr_1fr] gap-2 sm:gap-3">
      <div className={`${panelClass} flex flex-col items-center justify-center p-3 text-center`}>
        <span className="text-[10px] font-bold tracking-widest text-cyan-100 uppercase">Ходы</span>
        <strong
          className={`mt-1 text-3xl font-black tabular-nums ${session.movesLeft <= 5 ? "text-amber-200" : "text-white"}`}
        >
          {session.movesLeft}
        </strong>
        <span className="text-xs text-slate-400">из {session.movesTotal}</span>
      </div>
      <div className={`${panelClass} min-w-0 p-3 sm:p-4`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-widest text-cyan-100 uppercase">
            Цели · уровень {session.level}
          </span>
          <span className="hidden text-xs text-slate-400 sm:inline">
            {chapterName(session.level)}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap justify-around gap-x-2 gap-y-1">
          {Object.entries(goals).map(([rawKind, amount]) => {
            const kind = rawKind as keyof typeof raccoonObjectiveNames;
            const count = Math.min(session.collected[kind] ?? 0, amount ?? 0);
            const complete = count >= (amount ?? 0);
            return (
              <div
                key={kind}
                className={`flex items-center gap-1 rounded-lg px-1.5 py-1 ${complete ? "bg-emerald-400/15" : ""}`}
                title={raccoonObjectiveNames[kind]}
              >
                <RaccoonPartIcon part={kind} className="h-5 w-5 text-white sm:h-6 sm:w-6" />
                <span className="text-sm font-extrabold tabular-nums">
                  {count}
                  <span className="text-slate-400">/{amount}</span>
                </span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-center text-xs text-slate-300">
          Выполнено целей: {completedGoals} из {Object.keys(goals).length}
        </p>
      </div>
      <div className={`${panelClass} flex flex-col items-center justify-center p-3 text-center`}>
        <span className="text-[10px] font-bold tracking-widest text-cyan-100 uppercase">Очки</span>
        <strong className="mt-1 text-2xl font-black tabular-nums">
          {session.score.toLocaleString("ru-RU")}
        </strong>
        <span
          className="mt-1 flex gap-0.5 text-amber-200"
          aria-label={`${session.stars} из 3 звёзд`}
        >
          {[1, 2, 3].map((star) => (
            <Sparkles
              key={star}
              size={14}
              className={session.stars >= star ? "fill-amber-300" : "text-slate-600"}
              aria-hidden="true"
            />
          ))}
        </span>
      </div>
    </div>
  );
};

export const RaccoonActiveControls = ({
  session,
  processing,
  activeBooster,
  onBoosterToggle,
  onMagnet,
  onHint,
}: {
  session: RaccoonSession;
  processing: boolean;
  activeBooster: RaccoonBooster | null;
  onBoosterToggle: (booster: RaccoonBooster) => void;
  onMagnet: () => void;
  onHint: () => void;
}) => (
  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
    <div
      className={`${panelClass} flex flex-wrap items-center justify-center gap-2 p-3`}
      aria-label="Бустеры уровня"
    >
      {boosterOptions.map(({ id, name, description, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={activeBooster === id}
          title={description}
          disabled={processing || session.boosters[id] <= 0}
          onClick={() => onBoosterToggle(id)}
          className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 py-2 text-sm font-bold transition disabled:opacity-45 ${activeBooster === id ? "border-amber-200 bg-amber-300/20 text-amber-100" : "border-white/10 bg-white/5 text-white hover:bg-white/10"}`}
        >
          <Icon size={17} aria-hidden="true" /> {name}
          <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs tabular-nums">
            {session.boosters[id]}
          </span>
        </button>
      ))}
      {session.level === 100 && (
        <button
          type="button"
          disabled={processing || session.magnetCharges <= 0}
          onClick={onMagnet}
          className="flex min-h-11 items-center gap-2 rounded-xl border border-amber-200/20 bg-amber-300/10 px-3 py-2 text-sm font-bold text-amber-100 disabled:opacity-45"
        >
          <Sparkles size={17} aria-hidden="true" /> Магнит
          <span className="rounded-full bg-black/30 px-2 py-0.5 text-xs">
            {session.magnetCharges}
          </span>
        </button>
      )}
    </div>
    <button
      type="button"
      disabled={processing}
      onClick={onHint}
      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-cyan-200/20 bg-cyan-300/10 px-4 py-2 font-semibold text-cyan-100 hover:bg-cyan-300/20 disabled:opacity-50"
    >
      <Lightbulb size={18} aria-hidden="true" /> Подсказка
    </button>
  </div>
);

export const RaccoonSessionOutcome = ({
  session,
  pointsPerLevel,
  processing,
  onRestart,
  onNextLevel,
}: {
  session: RaccoonSession;
  pointsPerLevel: number;
  processing: boolean;
  onRestart: () => void;
  onNextLevel: () => void;
}) => (
  <section
    className={`${panelClass} flex flex-col items-center gap-3 p-5 text-center`}
    role="status"
  >
    <Trophy
      aria-hidden="true"
      className={session.status === "COMPLETE" ? "text-amber-200" : "text-rose-200"}
    />
    <h2 className="text-xl font-black">
      {session.status === "COMPLETE" ? "Уровень пройден!" : "Ходы закончились"}
    </h2>
    <p className="max-w-lg text-sm text-slate-300">
      {session.status === "COMPLETE"
        ? `Получите ${pointsPerLevel} игровых баллов в бонусный счёт. Уже начисленные баллы не будут выданы повторно.`
        : "Попробуйте ещё раз: соберите все комплектующие, пока не закончились ходы."}
    </p>
    <div className="flex flex-wrap justify-center gap-2">
      <button
        type="button"
        onClick={onRestart}
        disabled={processing}
        className="min-h-11 rounded-xl border border-white/15 bg-white/5 px-4 py-2 font-bold hover:bg-white/10 disabled:opacity-50"
      >
        {session.status === "COMPLETE" ? "Переиграть уровень" : "Повторить уровень"}
      </button>
      {session.status === "COMPLETE" && session.level < 100 && (
        <button
          type="button"
          onClick={onNextLevel}
          disabled={processing}
          className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-cyan-300 px-4 py-2 font-extrabold text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
        >
          Следующий уровень <ChevronRight size={17} aria-hidden="true" />
        </button>
      )}
    </div>
  </section>
);

export const RaccoonGameAside = ({ pointsPerLevel }: { pointsPerLevel: number }) => (
  <section className={`${panelClass} p-4`}>
    <h2 className="font-extrabold text-white">Как играть</h2>
    <ul className="mt-3 space-y-2 text-sm leading-5 text-slate-300">
      <li>Выбирайте соседние детали или меняйте их свайпом.</li>
      <li>Три одинаковые детали в ряд собирают комплектующие.</li>
      <li>Бустеры помогают пройти сложные уровни и не тратят ход.</li>
      <li>{pointsPerLevel} баллов за прохождение можно получить в любое время.</li>
    </ul>
  </section>
);

export const RaccoonCampaignPanel = ({
  progress,
  embedded,
  session,
  onChooseLevel,
}: {
  progress: RaccoonProgress;
  embedded: boolean;
  session: RaccoonSession | null;
  onChooseLevel: (level: number) => void;
}) =>
  embedded ? (
    <div className={`${panelClass} p-4`}>
      <p className="text-xs font-bold tracking-wider text-cyan-200 uppercase">Кампания</p>
      <p className="mt-1 text-2xl font-black">
        {progress.completedCount}
        <span className="text-sm font-semibold text-slate-400">/100</span>
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
        <div
          className="h-full rounded-full bg-cyan-300"
          style={{ width: `${Math.min(100, progress.completedCount)}%` }}
        />
      </div>
    </div>
  ) : (
    <details className={`${panelClass} p-4`} open={!session || session.status !== "ACTIVE"}>
      <summary className="cursor-pointer list-none font-extrabold text-white focus-visible:outline-2 focus-visible:outline-cyan-200">
        Карта кампании · {progress.completedCount}/100
      </summary>
      <div className="mt-4 max-h-[60vh] space-y-5 overflow-auto pr-1">
        <RaccoonLevelMap levels={progress.levels} onChoose={onChooseLevel} />
      </div>
    </details>
  );
