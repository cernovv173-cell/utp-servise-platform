import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { guides } from "@/features/guides/guides-content";

const toneStyles = {
  blue: {
    icon: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200",
    badge: "bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200",
  },
  amber: {
    icon: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
    badge: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-200",
  },
  emerald: {
    icon: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
} as const;

export const GuideCardGrid = () => (
  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    {guides.map((guide, index) => {
      const Icon = guide.icon;
      const tone = toneStyles[guide.tone];

      return (
        <Link
          key={guide.slug}
          to={guide.href}
          aria-label={`Открыть памятку: ${guide.title}`}
          className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 md:p-6 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 dark:hover:border-cyan-400/35 dark:hover:shadow-[0_18px_42px_rgba(0,0,0,0.28)]"
        >
          <div className="flex items-start justify-between gap-3">
            <span className={`grid size-12 place-items-center rounded-2xl ${tone.icon}`}>
              <Icon size={23} aria-hidden="true" />
            </span>
            <span className="text-xs font-bold tracking-[0.16em] text-slate-400 uppercase">
              0{index + 1}
            </span>
          </div>
          <span
            className={`mt-5 w-fit rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] uppercase ${tone.badge}`}
          >
            {guide.category}
          </span>
          <h3 className="mt-3 text-lg leading-snug font-semibold text-slate-900 group-hover:text-blue-700 dark:text-white dark:group-hover:text-cyan-200">
            {guide.title}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            {guide.summary}
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-cyan-200">
            Открыть памятку
            <ArrowRight
              size={16}
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-1"
            />
          </span>
        </Link>
      );
    })}
  </div>
);
