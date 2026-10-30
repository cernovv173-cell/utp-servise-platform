import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpenCheck, ShieldCheck } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PublicSiteShell, repairRequestHref } from "@/components/public-site-shell";

import { useAuth } from "@/features/auth/auth-context";
import { GuideCardGrid } from "@/features/guides/guide-card-grid";

const GuideIndexContent = () => {
  const { ready, user } = useAuth();
  const intro = (
    <div className="space-y-7">
      <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-7 text-white shadow-[0_24px_70px_rgba(37,99,235,0.18)] sm:p-10">
        <div className="absolute -top-16 -right-12 -z-10 size-64 rounded-full border border-white/15" />
        <div className="absolute right-16 bottom-[-7rem] -z-10 size-56 rounded-full border border-white/15" />
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold tracking-[0.16em] uppercase">
            <BookOpenCheck size={15} aria-hidden="true" /> Памятки сервиса
          </p>
          <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Подготовьтесь к ремонту спокойно
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-blue-50 sm:text-base">
            Всё важное — коротко и без сложных терминов. Выберите памятку, отметьте нужное и
            переходите к заявке, когда будете готовы.
          </p>
          <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-blue-50">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck size={16} aria-hidden="true" /> Понятные шаги
            </span>
            <span className="inline-flex items-center gap-2">
              <BookOpenCheck size={16} aria-hidden="true" /> Доступно без регистрации
            </span>
          </div>
        </div>
      </section>

      <div>
        <div className="mb-5 max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Выберите тему
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight md:text-3xl">
            Три короткие памятки
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Отмечайте пункты прямо на странице — чек-листы не требуют регистрации.
          </p>
        </div>
        <GuideCardGrid />
      </div>

      <section className="grid gap-5 rounded-3xl border border-blue-100 bg-blue-50/75 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center dark:border-cyan-400/20 dark:bg-[#0d1b38]/80">
        <div>
          <p className="text-xs font-bold tracking-[0.18em] text-blue-700 uppercase dark:text-cyan-200">
            Нужна помощь?
          </p>
          <h2 className="mt-2 text-xl font-semibold">Опишите проблему — подскажем следующий шаг</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Создайте заявку, чтобы рассказать о неисправности и согласовать диагностику.
          </p>
        </div>
        {user ? (
          <Link
            to="/orders"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Оставить заявку <ArrowRight size={17} aria-hidden="true" />
          </Link>
        ) : (
          <a
            href={repairRequestHref}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            Оставить заявку <ArrowRight size={17} aria-hidden="true" />
          </a>
        )}
      </section>
    </div>
  );

  if (!ready) {
    return <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем…</div>;
  }

  return user ? (
    <AppShell active="/guides">{intro}</AppShell>
  ) : (
    <PublicSiteShell>
      <div className="mx-auto max-w-7xl px-4 py-9 md:px-8 md:py-12">{intro}</div>
    </PublicSiteShell>
  );
};

export const GuidesIndexPage = () => <GuideIndexContent />;
