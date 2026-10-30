import { Check, RotateCcw } from "lucide-react";
import { useId, useState } from "react";

import type { GuideItem } from "@/features/guides/guides-content";

export const GuideChecklist = ({ items }: { items: readonly GuideItem[] }) => {
  const id = useId();
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const completed = Object.values(checked).filter(Boolean).length;
  const progress = items.length > 0 ? Math.round((completed / items.length) * 100) : 0;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
          Отмечено{" "}
          <span className="font-semibold text-slate-800 dark:text-slate-200">{completed}</span> из{" "}
          {items.length}
        </p>
        {completed > 0 && (
          <button
            type="button"
            onClick={() => setChecked({})}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-cyan-200 dark:hover:bg-[#152449]"
          >
            <RotateCcw size={14} aria-hidden="true" /> Сбросить
          </button>
        )}
      </div>
      <div
        role="progressbar"
        aria-label="Выполнение чек-листа"
        aria-valuemin={0}
        aria-valuemax={items.length}
        aria-valuenow={completed}
        className="mb-5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#1b2b52]"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-600 to-cyan-400 transition-[width] duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
      <ul className="grid gap-3">
        {items.map((item, index) => {
          const inputId = `${id}-${index}`;
          const isChecked = Boolean(checked[index]);

          return (
            <li key={item.title}>
              <label
                htmlFor={inputId}
                className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-600 ${isChecked ? "border-blue-200 bg-blue-50/70 dark:border-cyan-400/25 dark:bg-cyan-400/5" : "border-slate-200 bg-white/75 hover:border-blue-200 hover:bg-blue-50/35 dark:border-[#304373] dark:bg-[#101b38]/70 dark:hover:border-cyan-400/25 dark:hover:bg-[#13264a]"}`}
              >
                <input
                  id={inputId}
                  type="checkbox"
                  checked={isChecked}
                  onChange={(event) =>
                    setChecked((current) => ({ ...current, [index]: event.target.checked }))
                  }
                  className="mt-0.5 size-5 shrink-0 rounded border-slate-300 accent-blue-600 dark:border-slate-600"
                />
                <span className="grid min-w-0 gap-1">
                  <span className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                    {item.title}
                    {isChecked && (
                      <Check
                        size={15}
                        className="shrink-0 text-blue-600 dark:text-cyan-200"
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className="text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {item.description}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {completed === items.length && items.length > 0 && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 dark:bg-emerald-400/10 dark:text-emerald-200">
          Всё готово — теперь можно спокойно оформить заявку.
        </p>
      )}
    </div>
  );
};
