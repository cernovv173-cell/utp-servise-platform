import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Clock3, Phone, ShieldCheck, Wrench } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PublicSiteShell } from "@/components/public-site-shell";
import { RaccoonIcon } from "@/components/raccoon-icon";
import { Reveal } from "@/components/reveal";

import { useAuth } from "@/features/auth/auth-context";
import { servicePages } from "@/features/services/service-pages-content";
import { ServiceRequestButton } from "@/features/services/service-request-button";

import { getCompany } from "@/lib/api";

const primaryButton =
  "inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white shadow-sm transition hover:bg-blue-700";

export const ServicesIndexPage = () => {
  const { ready, user } = useAuth();
  const companyQuery = useQuery({
    queryKey: ["public-company"],
    queryFn: ({ signal }) => getCompany(signal),
  });
  const company = companyQuery.data?.company;
  const phoneHref = company?.phone?.replace(/[^\d+]/gu, "");

  const content = (
    <>
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-[#26365f]/70">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
          <nav
            aria-label="Хлебные крошки"
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
          >
            <Link to="/" className="hover:text-blue-700 dark:hover:text-cyan-200">
              Главная
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-slate-700 dark:text-slate-200">
              Услуги
            </span>
          </nav>

          <div className="mt-6 max-w-3xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold tracking-[0.16em] text-blue-700 uppercase dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200">
              <RaccoonIcon motion="peek" className="text-sm" />
              Сервис в Пушкино
            </p>
            <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-4xl md:text-5xl dark:text-white">
              Услуги сервисного центра
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600 dark:text-slate-300">
              Ремонт ноутбуков и телефонов, чистка от пыли, замена экрана и восстановление данных.
              Цены берём из действующего прайса, а точную смету согласуем до начала работ.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <ServiceRequestButton className={primaryButton} />
              {company?.phone && (
                <a
                  href={`tel:${phoneHref}`}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-5 font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-300/20"
                >
                  <Phone size={17} aria-hidden="true" />
                  Позвонить
                </a>
              )}
            </div>
            <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
              {["С 2008 года", "Гарантия и документы", "Ежедневно 8:30–21:30"].map((item) => (
                <li key={item} className="inline-flex items-center gap-2">
                  <CheckCircle2
                    size={16}
                    className="text-blue-600 dark:text-cyan-300"
                    aria-hidden="true"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Направления
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">С чем можем помочь</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Выберите услугу, чтобы увидеть состав работ и цены из прайса.
          </p>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {servicePages.map((page, index) => {
            const Icon = page.icon;
            return (
              <Reveal key={page.slug} delay={index * 0.05} className="h-full">
                <Link
                  to={page.path}
                  className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 dark:hover:border-cyan-300/40"
                >
                  <div className="grid size-12 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                    <Icon size={24} aria-hidden="true" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{page.navLabel}</h3>
                  <p className="mt-2 flex-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {page.cardSummary}
                  </p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-cyan-200">
                    Цены и условия
                    <ArrowRight
                      size={15}
                      className="transition group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              </Reveal>
            );
          })}

          <Reveal delay={0.25} className="h-full">
            <div className="flex h-full flex-col rounded-2xl border border-dashed border-blue-200 bg-blue-50/60 p-6 dark:border-cyan-400/30 dark:bg-cyan-400/5">
              <div className="grid size-12 place-items-center rounded-2xl bg-white/80 text-blue-700 dark:bg-[#0c142b]/80 dark:text-cyan-200">
                <Wrench size={24} aria-hidden="true" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Другая неисправность?</h3>
              <p className="mt-2 flex-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
                Опишите проблему — подскажем, что можно сделать и сколько будет стоить диагностика.
              </p>
              <div className="mt-4">
                <ServiceRequestButton
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                  label="Задать вопрос"
                />
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/45 dark:border-[#26365f]/70 dark:bg-[#080e20]/30">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
              Почему нам доверяют
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Сервис с 2008 года</h2>
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            {[
              {
                icon: ShieldCheck,
                title: "Смета до ремонта",
                text: "Сначала диагностика и согласование стоимости, потом работы.",
              },
              {
                icon: Wrench,
                title: "Опытные мастера",
                text: "Более 10 000 выполненных работ для частных клиентов и организаций.",
              },
              {
                icon: Clock3,
                title: "На связи",
                text: "Статус ремонта и переписка доступны в личном кабинете.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="flex flex-col gap-5 rounded-[2rem] bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold">Не знаете, какая услуга нужна?</h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">
              Опишите устройство и что происходит — подскажем по диагностике и ремонту.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <ServiceRequestButton className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-white px-5 font-semibold text-blue-700 shadow-sm transition hover:bg-blue-50" />
            {company?.phone && (
              <a
                href={`tel:${phoneHref}`}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-white/40 px-5 font-semibold text-white transition hover:bg-white/10"
              >
                <Phone size={17} aria-hidden="true" />
                Позвонить
              </a>
            )}
          </div>
        </div>
      </section>
    </>
  );

  if (!ready)
    return <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем…</div>;
  return user ? (
    <AppShell active="/">{content}</AppShell>
  ) : (
    <PublicSiteShell>{content}</PublicSiteShell>
  );
};
