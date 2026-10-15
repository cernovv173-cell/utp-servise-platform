import { Check, LockKeyhole, Sparkles } from "lucide-react";

import type { Match3Progress } from "./game-api";

const buildParts = [
  { key: "case", name: "Корпус", icon: "🖥️", readyAt: 20 },
  { key: "motherboard", name: "Материнская плата", icon: "🟩", readyAt: 40 },
  { key: "processor", name: "Процессор", icon: "🧠", readyAt: 60 },
  { key: "cooling", name: "Охлаждение", icon: "🌀", readyAt: 80 },
  { key: "gpu", name: "Видеокарта", icon: "🎮", readyAt: 85 },
  { key: "ssd", name: "SSD-накопитель", icon: "💽", readyAt: 90 },
  { key: "ram", name: "Оперативная память", icon: "🧩", readyAt: 95 },
  { key: "power", name: "Блок питания", icon: "⚡", readyAt: 100 },
];

export const ComputerBuildProgress = ({ completedCount }: { completedCount: number }) => (
  <section className="rounded-3xl border border-[#294277]/70 bg-[#0b132a]/90 p-5 text-[#edf2ff] shadow-[0_20px_70px_rgba(0,0,0,0.2)] backdrop-blur-xl">
    <div className="flex items-center gap-2 text-cyan-200">
      <Sparkles size={17} aria-hidden="true" />
      <h2 className="font-semibold">Чертёж компьютера</h2>
    </div>
    <p className="mt-2 text-sm leading-6 text-[#a9b8dc]">
      Каждый этап приближает енота к готовой сборке.
    </p>
    <div className="mt-5 grid grid-cols-2 gap-2">
      {buildParts.map((part) => {
        const ready = completedCount >= part.readyAt;
        return (
          <div
            key={part.key}
            className={`rounded-2xl border p-3 ${ready ? "border-cyan-300/35 bg-cyan-300/10" : "border-[#26365f] bg-[#101a34]/70 opacity-70"}`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl" aria-hidden="true">{part.icon}</span>
              {ready ? (
                <Check size={15} className="text-cyan-200" aria-label="Готово" />
              ) : (
                <LockKeyhole size={14} className="text-[#8090b9]" aria-hidden="true" />
              )}
            </div>
            <p className="mt-2 text-xs font-medium leading-4">{part.name}</p>
            <p className="mt-1 text-[10px] text-[#8fa0c8]">
              {ready ? "Собрано" : `Этап ${part.readyAt}`}
            </p>
          </div>
        );
      })}
    </div>
    <div className="mt-5 flex items-center justify-between text-sm">
      <span className="text-[#9caed4]">Сборка</span>
      <span className="font-semibold text-cyan-100">{completedCount} / 100 этапов</span>
    </div>
    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#1b294a]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 transition-[width]"
        style={{ width: `${completedCount}%` }}
      />
    </div>
  </section>
);

export const ChapterProgress = ({ progress }: { progress: Match3Progress }) => {
  const chapters = Array.from(
    new Map(progress.levels.map((level) => [level.chapter.number, level.chapter])).values(),
  );

  return (
    <section className="mt-6">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300 uppercase">Путь енота</p>
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
                  <p className="text-xs font-semibold text-cyan-300">ГЛАВА {chapter.number} · {chapter.setting}</p>
                  <h3 className="mt-1 font-semibold">{chapter.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-[#a0afd2]">{chapter.description}</p>
                </div>
                <span className="rounded-full border border-[#304373] px-2.5 py-1 text-xs text-[#b6c8f4]">
                  {completed} / {chapterLevels.length}
                </span>
              </div>
              <ol className="mt-4 grid grid-cols-10 gap-1.5" aria-label={`Уровни главы ${chapter.number}`}>
                {chapterLevels.map((level) => (
                  <li key={level.number}>
                    <span
                      title={`Уровень ${level.number}${level.isCompleted ? " — пройден" : level.isUnlocked ? " — доступен" : " — закрыт"}`}
                      aria-label={`Уровень ${level.number}${level.isCompleted ? ", пройден" : level.isUnlocked ? ", доступен" : ", закрыт"}`}
                      className={`grid aspect-square place-items-center rounded-lg border text-[10px] font-semibold ${level.isCompleted ? "border-emerald-300/35 bg-emerald-400/15 text-emerald-100" : level.isUnlocked ? "border-cyan-200/60 bg-cyan-300/15 text-cyan-50 ring-1 ring-cyan-300/20" : "border-[#26365f] bg-[#111a33]/70 text-[#637394]"}`}
                    >
                      {level.isCompleted ? <Check size={12} aria-hidden="true" /> : level.isUnlocked ? level.number : "·"}
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
