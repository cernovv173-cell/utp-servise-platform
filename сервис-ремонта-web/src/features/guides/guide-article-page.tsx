import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, CircleAlert, ClipboardCheck, Printer } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PublicSiteShell, repairRequestHref } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";
import { GuideChecklist } from "@/features/guides/guide-checklist";
import { type GuideSlug, getGuide } from "@/features/guides/guides-content";

const noteStyles = {
  blue: "border-blue-200 bg-blue-50/80 text-blue-950 dark:border-blue-400/20 dark:bg-blue-400/5 dark:text-blue-100",
  amber:
    "border-amber-200 bg-amber-50/80 text-amber-950 dark:border-amber-400/20 dark:bg-amber-400/5 dark:text-amber-100",
} as const;

const GuideArticleContent = ({ slug }: { slug: GuideSlug }) => {
  const { ready, user } = useAuth();
  const guide = getGuide(slug);

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем…</div>;
  }

  if (!guide) {
    return <div className="p-8 text-center">Памятка не найдена.</div>;
  }

  const Icon = guide.icon;
  const content = (
    <article className="space-y-6">
      <nav
        aria-label="Навигационная цепочка"
        className="flex flex-wrap items-center gap-2 text-sm print:hidden"
      >
        <Link to="/guides" className="font-medium text-blue-700 hover:underline dark:text-cyan-200">
          Полезное
        </Link>
        <span aria-hidden="true" className="text-slate-400">
          /
        </span>
        <span className="text-slate-500 dark:text-slate-400" aria-current="page">
          {guide.title}
        </span>
        <button
          type="button"
          onClick={() => window.print()}
          className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white/80 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-[#304373] dark:bg-[#0c142b]/70 dark:text-slate-200 dark:hover:bg-[#152449]"
        >
          <Printer size={15} aria-hidden="true" /> Распечатать
        </button>
      </nav>

      <header className="relative isolate overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-white via-blue-50 to-cyan-50 p-6 sm:p-9 dark:border-[#304373] dark:from-[#101a34] dark:via-[#102344] dark:to-[#0d2a42] print:border-0 print:bg-white print:p-0 print:shadow-none">
        <div className="absolute -top-16 -right-12 -z-10 size-52 rounded-full border border-blue-200/60 dark:border-cyan-300/15 print:hidden" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <span className="grid size-14 place-items-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/20 dark:bg-cyan-300 dark:text-slate-950 print:hidden">
            <Icon size={26} aria-hidden="true" />
          </span>
          <span className="rounded-full border border-blue-200 bg-white/75 px-3 py-1.5 text-xs font-bold tracking-[0.12em] text-blue-700 uppercase dark:border-[#405b9c] dark:bg-[#0c142b]/70 dark:text-cyan-200 print:border-slate-300 print:bg-white print:text-slate-700">
            {guide.category}
          </span>
        </div>
        <h1 className="mt-6 max-w-4xl text-3xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-white print:mt-2 print:text-3xl print:text-black">
          {guide.title}
        </h1>
        <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600 dark:text-slate-300 print:text-slate-700">
          {guide.summary}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_19rem] print:block">
        <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm sm:p-7 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 print:border-0 print:p-0 print:shadow-none">
          <div className="mb-5 flex items-start gap-3 print:mb-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200 print:hidden">
              {guide.kind === "checklist" ? (
                <ClipboardCheck size={20} aria-hidden="true" />
              ) : (
                <Icon size={20} aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white print:text-black">
                {guide.listTitle}
              </h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 print:hidden">
                {guide.kind === "checklist"
                  ? "Отмечайте пункты по мере подготовки."
                  : "Если замечаете несколько пунктов, стоит проверить устройство."}
              </p>
            </div>
          </div>
          {guide.kind === "checklist" ? (
            <GuideChecklist items={guide.items} />
          ) : (
            <ol className="grid gap-3 print:gap-2">
              {guide.items.map((item, index) => (
                <li
                  key={item.title}
                  className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50/75 p-4 dark:border-[#304373] dark:bg-[#101b38]/70 print:rounded-none print:border-slate-300 print:bg-white print:p-2"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-amber-100 text-sm font-bold text-amber-800 dark:bg-amber-300/15 dark:text-amber-200 print:bg-white print:text-black">
                    {index + 1}
                  </span>
                  <span className="grid gap-1">
                    <span className="font-semibold text-slate-900 dark:text-white print:text-black">
                      {item.title}
                    </span>
                    <span className="text-sm leading-6 text-slate-500 dark:text-slate-400 print:text-slate-700">
                      {item.description}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <aside className="grid content-start gap-4 print:mt-5">
          <section
            className={`rounded-3xl border p-5 print:rounded-xl print:bg-white print:text-black ${noteStyles[guide.note.tone ?? "blue"]}`}
          >
            <div className="flex items-start gap-3">
              <CircleAlert size={19} className="mt-0.5 shrink-0 print:hidden" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">{guide.note.title}</h2>
                <p className="mt-2 text-sm leading-6 opacity-85">{guide.note.text}</p>
                {guide.note.safetyText && (
                  <p className="mt-3 border-t border-current/15 pt-3 text-sm leading-6 font-semibold">
                    {guide.note.safetyText}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 print:hidden">
            <p className="text-xs font-bold tracking-[0.16em] text-blue-600 uppercase dark:text-cyan-300">
              Следующий шаг
            </p>
            <h2 className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
              Нужна диагностика?
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Опишите неисправность — сервис поможет согласовать обращение.
            </p>
            {user ? (
              <Link
                to="/orders"
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Оставить заявку <ArrowRight size={16} aria-hidden="true" />
              </Link>
            ) : (
              <a
                href={repairRequestHref}
                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
              >
                Оставить заявку <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </section>
        </aside>
      </div>

      <Link
        to="/guides"
        className="inline-flex min-h-10 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-cyan-200 dark:hover:bg-[#152449] print:hidden"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Все памятки
      </Link>
    </article>
  );

  return user ? (
    <AppShell active="/guides">{content}</AppShell>
  ) : (
    <PublicSiteShell>
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">{content}</div>
    </PublicSiteShell>
  );
};

export const GuideArticlePage = ({ slug }: { slug: GuideSlug }) => (
  <GuideArticleContent slug={slug} />
);
