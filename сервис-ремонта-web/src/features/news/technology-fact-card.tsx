import { Lightbulb } from "lucide-react";

import { SectionCard } from "@/components/app-shell";

import type { TechnologyFact } from "@/lib/api";

export const TechnologyFactCard = ({ fact }: { fact: TechnologyFact }) => {
  const nextUpdateTime = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(fact.nextUpdateAt));

  return (
    <section aria-label="Факт о компьютерных технологиях" aria-live="polite" aria-atomic="true">
      <SectionCard className="mb-5 border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/20">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-200">
            <Lightbulb aria-hidden="true" size={20} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-amber-800 uppercase dark:text-amber-300">
              Факт о технологиях
            </p>
            <h2 className="mt-1 text-lg font-semibold">{fact.title}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
              {fact.content}
            </p>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-xs">
              <a
                href={fact.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-blue-700 underline decoration-blue-300 underline-offset-2 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200"
              >
                Источник: {fact.sourceName}
              </a>
              <p className="text-slate-500 dark:text-slate-400">
                Следующий факт — около {nextUpdateTime} · обновление каждые 2 часа
              </p>
            </div>
          </div>
        </div>
      </SectionCard>
    </section>
  );
};
