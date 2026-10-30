import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";

import { GuideCardGrid } from "@/features/guides/guide-card-grid";

export const GuidesSection = ({ compact = false }: { compact?: boolean }) => (
  <section className={compact ? "mb-7" : "mx-auto max-w-7xl px-4 py-12 md:px-8"}>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
          <BookOpen size={15} aria-hidden="true" />
          Полезное клиентам
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
          Полезное перед ремонтом
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
          Короткие памятки, чтобы подготовить устройство и ничего не забыть.
        </p>
      </div>
      <Link
        to="/guides"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-[#304373] dark:bg-[#0c142b]/70 dark:text-slate-200 dark:hover:bg-[#152449]"
      >
        Все памятки <ArrowRight size={16} aria-hidden="true" />
      </Link>
    </div>
    <GuideCardGrid />
  </section>
);
