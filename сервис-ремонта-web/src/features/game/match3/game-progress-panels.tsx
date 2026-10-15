import {
  Check,
  CircuitBoard,
  Cpu,
  Fan,
  Gamepad2,
  HardDrive,
  LockKeyhole,
  type LucideIcon,
  MemoryStick,
  PcCase,
  Sparkles,
  Zap,
} from "lucide-react";

import type { Match3Progress } from "./game-api";

const buildParts = [
  { key: "case", name: "Корпус", icon: PcCase, readyAt: 20 },
  { key: "motherboard", name: "Материнская плата", icon: CircuitBoard, readyAt: 40 },
  { key: "processor", name: "Процессор", icon: Cpu, readyAt: 60 },
  { key: "cooling", name: "Охлаждение", icon: Fan, readyAt: 80 },
  { key: "gpu", name: "Видеокарта", icon: Gamepad2, readyAt: 85 },
  { key: "ssd", name: "SSD-накопитель", icon: HardDrive, readyAt: 90 },
  { key: "ram", name: "Оперативная память", icon: MemoryStick, readyAt: 95 },
  { key: "power", name: "Блок питания", icon: Zap, readyAt: 100 },
];

export const ComputerBuildProgress = ({ completedCount }: { completedCount: number }) => {
  const readyParts = buildParts.filter((part) => completedCount >= part.readyAt).length;
  const currentPart = buildParts.find((part) => completedCount < part.readyAt);

  return (
    <section className="rounded-3xl border border-[#294277]/70 bg-[#0b132a]/90 p-5 text-[#edf2ff] shadow-[0_20px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl">
      <div className="flex items-center gap-2 text-cyan-200">
        <Sparkles size={17} aria-hidden="true" />
        <h2 className="font-semibold">Компьютер енота</h2>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#a9b8dc]">
        Компоненты появляются на чертеже по мере прохождения уровней.
      </p>
      <div className="mt-5 flex items-center gap-4 rounded-2xl border border-[#26365f] bg-[#101a34]/70 p-4">
        <div
          className={`grid size-16 shrink-0 place-items-center rounded-2xl border transition-all ${readyParts ? "border-cyan-200/40 bg-cyan-300/10 text-cyan-100 shadow-[0_0_22px_rgba(82,232,255,0.12)]" : "border-[#26365f] text-[#637394]"}`}
          aria-label={`${readyParts} из ${buildParts.length} деталей установлено`}
        >
          <PcCase size={38} strokeWidth={1.5} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-cyan-100">
            {readyParts === buildParts.length
              ? "Компьютер собран!"
              : readyParts
                ? `Установлено деталей: ${readyParts}`
                : "Чертёж ждёт первую деталь"}
          </p>
          <p className="mt-1 text-xs text-[#9caed4]">
            {currentPart ? `Следом: ${currentPart.name}` : "Можно нажимать кнопку запуска!"}
          </p>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[#1b294a]"
            role="progressbar"
            aria-label="Сборка компьютера"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={completedCount}
          >
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-[width] duration-500"
              style={{ width: `${completedCount}%` }}
            />
          </div>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-2" aria-label="Детали компьютера по мере сборки">
        {buildParts.map((part) => {
          const ready = completedCount >= part.readyAt;
          const Icon: LucideIcon = part.icon;
          return (
            <div
              key={part.key}
              title={`${part.name}: ${ready ? "собрано" : `откроется на этапе ${part.readyAt}`}`}
              className={`grid min-h-20 content-center justify-items-center gap-1 rounded-xl border p-2 text-center transition-all duration-300 ${ready ? "border-cyan-300/35 bg-cyan-300/10 text-cyan-100" : "border-[#26365f] bg-[#101a34]/70 text-[#637394]"}`}
            >
              <Icon size={19} aria-hidden="true" />
              <p className="text-[9px] leading-3">{part.name}</p>
              {ready ? (
                <Check size={12} className="text-emerald-200" aria-label="Собрано" />
              ) : (
                <LockKeyhole size={11} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-[#9caed4]">Путь сборки</span>
        <span className="font-semibold text-cyan-100">{completedCount} / 100 этапов</span>
      </div>
    </section>
  );
};

export const ChapterProgress = ({ progress }: { progress: Match3Progress }) => {
  const chapters = Array.from(
    new Map(progress.levels.map((level) => [level.chapter.number, level.chapter])).values(),
  );

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300 uppercase">
            Путь енота
          </p>
          <h2 className="mt-1 text-xl font-semibold text-white">Пять глав · 100 уровней</h2>
        </div>
        <p className="hidden text-xs text-[#a2b2d7] sm:block">Открывается по порядку</p>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {chapters.map((chapter) => {
          const chapterLevels = progress.levels.filter(
            (level) => level.number >= chapter.firstLevel && level.number <= chapter.lastLevel,
          );
          const completed = chapterLevels.filter((level) => level.isCompleted).length;
          return (
            <article
              key={chapter.number}
              className="rounded-3xl border border-[#26365f] bg-[#0b132a]/85 p-4 text-[#edf2ff]"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-cyan-300">
                    ГЛАВА {chapter.number} · {chapter.setting}
                  </p>
                  <h3 className="mt-1 font-semibold">{chapter.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#a0afd2]">{chapter.description}</p>
                </div>
                <span className="rounded-full border border-[#304373] px-2.5 py-1 text-xs text-[#b6c8f4]">
                  {completed} / {chapterLevels.length}
                </span>
              </div>
              <ol
                className="mt-4 grid grid-cols-10 gap-1.5"
                aria-label={`Уровни главы ${chapter.number}`}
              >
                {chapterLevels.map((level) => (
                  <li key={level.number}>
                    <span
                      title={`Уровень ${level.number}${level.isCompleted ? " — пройден" : level.isUnlocked ? " — доступен" : " — закрыт"}`}
                      aria-label={`Уровень ${level.number}${level.isCompleted ? ", пройден" : level.isUnlocked ? ", доступен" : ", закрыт"}`}
                      className={`grid aspect-square place-items-center rounded-lg border text-[10px] font-semibold ${level.isCompleted ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-100" : level.isUnlocked ? "border-cyan-200/60 bg-cyan-300/15 text-cyan-50 ring-1 ring-cyan-300/20" : "border-[#26365f] bg-[#111a33]/70 text-[#637394]"}`}
                    >
                      {level.isCompleted ? (
                        <Check size={12} aria-hidden="true" />
                      ) : level.isUnlocked ? (
                        level.number
                      ) : (
                        "·"
                      )}
                    </span>
                  </li>
                ))}
              </ol>
            </article>
          );
        })}
      </div>
    </section>
  );
};
