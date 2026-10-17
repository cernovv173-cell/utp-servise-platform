import { ChevronRight, Lightbulb, VolumeX, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getRaccoonGuideHint } from "@/components/raccoon-guide-hints";

const getGuideStorageKey = (userId: string) => `utp-raccoon-guide:${userId}`;

export const RaccoonGuide = ({
  active,
  role,
  userId,
  offsetForAdminAction = false,
}: {
  active: string;
  role: string;
  userId: string;
  offsetForAdminAction?: boolean;
}) => {
  const storageKey = getGuideStorageKey(userId);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(storageKey) !== "off");
  const [expanded, setExpanded] = useState(true);
  const [pose, setPose] = useState(1);
  const hint = useMemo(() => getRaccoonGuideHint(active, role), [active, role]);

  useEffect(() => {
    localStorage.setItem(storageKey, enabled ? "on" : "off");
  }, [enabled, storageKey]);

  useEffect(() => {
    if (!enabled || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const interval = window.setInterval(() => {
      setPose((current) => (current + 1) % 3);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [enabled]);

  const toggleEnabled = () => setEnabled((current) => !current);

  if (!enabled) {
    return (
      <button
        aria-label="Включить помощника-енота"
        className={`raccoon-guide-launcher fixed right-4 z-40 grid size-12 place-items-center rounded-full border border-cyan-200/70 bg-[#fff6e5] text-2xl shadow-[0_10px_30px_rgba(19,47,100,0.24)] transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 ${offsetForAdminAction ? "bottom-24" : "bottom-5"}`}
        onClick={toggleEnabled}
        type="button"
      >
        <span aria-hidden="true">🦝</span>
      </button>
    );
  }

  return (
    <aside
      aria-label="Помощник по сайту"
      className={`fixed right-4 z-40 flex w-[min(22rem,calc(100vw-2rem))] flex-col items-end gap-2 sm:right-6 ${offsetForAdminAction ? "bottom-24" : "bottom-5"}`}
    >
      {expanded && (
        <section className="w-full rounded-3xl border border-cyan-100 bg-white/95 p-4 text-slate-800 shadow-[0_18px_48px_rgba(19,47,100,0.2)] backdrop-blur-xl dark:border-[#35559f] dark:bg-[#101b39]/95 dark:text-[#edf2ff]">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-[#18325d] dark:text-[#9aeeff]">
              <Lightbulb size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold tracking-[0.16em] text-cyan-700 uppercase dark:text-[#8cecff]">
                    Енот-помощник
                  </p>
                  <h2 className="mt-1 text-sm font-semibold">{hint.title}</h2>
                </div>
                <button
                  aria-label="Свернуть подсказку"
                  className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-[#1b2b51] dark:hover:text-white"
                  onClick={() => setExpanded(false)}
                  type="button"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <p className="mt-2 text-sm leading-5 text-slate-600 dark:text-slate-300">
                {hint.message}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {hint.action && (
                  <a
                    className="inline-flex min-h-9 items-center gap-1 rounded-xl bg-cyan-600 px-3 text-xs font-semibold text-white transition hover:bg-cyan-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400"
                    href={hint.action.href}
                  >
                    {hint.action.label}
                    <ChevronRight size={14} aria-hidden="true" />
                  </a>
                )}
                <button
                  className="inline-flex min-h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-[#35559f] dark:text-slate-200 dark:hover:bg-[#18284b]"
                  onClick={toggleEnabled}
                  type="button"
                >
                  <VolumeX size={14} aria-hidden="true" />
                  Выключить
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
      <button
        aria-label={expanded ? "Свернуть помощника-енота" : "Показать подсказку енота"}
        className="group rounded-[2rem] border border-cyan-200/80 bg-[#fff6e5] px-2 pt-2 shadow-[0_14px_36px_rgba(19,47,100,0.22)] transition hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400 dark:border-[#35559f]"
        onClick={() => setExpanded((current) => !current)}
        type="button"
      >
        <span
          aria-hidden="true"
          className={`raccoon-guide-sprite raccoon-guide-sprite--${pose} block ${expanded ? "raccoon-guide-sprite--compact" : ""}`}
        />
        <span className="sr-only">{expanded ? "Свернуть подсказку" : "Показать подсказку"}</span>
      </button>
      {!expanded && (
        <span className="pointer-events-none absolute right-20 bottom-4 rounded-xl bg-slate-900 px-3 py-2 text-xs font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition group-hover:opacity-100 dark:bg-white dark:text-slate-900">
          Показать подсказку
        </span>
      )}
    </aside>
  );
};
