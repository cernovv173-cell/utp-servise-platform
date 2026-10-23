import { Check, LockKeyhole } from "lucide-react";

import type { RaccoonProgress } from "./raccoon-game-api";
import { raccoonChapters } from "./raccoon-game-theme";

export const RaccoonLevelMap = ({
  levels,
  onChoose,
}: {
  levels: RaccoonProgress["levels"];
  onChoose: (level: number) => void;
}) => (
  <div className="space-y-4">
    {raccoonChapters.map((chapter, chapterIndex) => {
      const chapterLevels = levels.filter(
        ({ number }) => Math.ceil(number / 20) === chapterIndex + 1,
      );
      if (chapterLevels.length === 0) return null;
      return (
        <section key={chapter.name} aria-label={`Глава ${chapter.number}: ${chapter.name}`}>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-cyan-100">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-cyan-300/15 text-xs text-cyan-200">
              {chapter.number}
            </span>
            <h3>{chapter.name}</h3>
            <span className="text-xs font-medium text-slate-400">
              уровни {chapterIndex * 20 + 1}–{chapterIndex * 20 + 20}
            </span>
          </div>
          <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
            {chapterLevels.map((level) => (
              <button
                key={level.number}
                type="button"
                disabled={!level.isUnlocked}
                onClick={() => onChoose(level.number)}
                aria-label={`Уровень ${level.number}${level.isCompleted ? ", пройден" : level.isUnlocked ? ", доступен" : ", закрыт"}`}
                title={level.title}
                className={`relative grid aspect-square place-items-center rounded-xl border text-sm font-extrabold tabular-nums transition focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:cursor-not-allowed ${level.isCompleted ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-100 hover:bg-emerald-400/25" : level.isUnlocked ? "border-cyan-200/40 bg-cyan-300/10 text-white hover:-translate-y-0.5 hover:bg-cyan-300/20" : "border-white/5 bg-slate-950/50 text-slate-600"}`}
              >
                {level.isCompleted ? <Check size={16} aria-hidden="true" /> : level.number}
                {!level.isUnlocked && (
                  <LockKeyhole
                    className="absolute -top-1 -right-1 rounded-full bg-slate-950 p-0.5 text-slate-500"
                    size={17}
                    aria-hidden="true"
                  />
                )}
              </button>
            ))}
          </div>
        </section>
      );
    })}
  </div>
);
