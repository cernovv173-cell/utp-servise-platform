import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ChevronDown, Clock3, Phone } from "lucide-react";

import { AppShell } from "@/components/app-shell";
import { PublicSiteShell } from "@/components/public-site-shell";
import { RaccoonIcon } from "@/components/raccoon-icon";
import { Reveal } from "@/components/reveal";

import { useAuth } from "@/features/auth/auth-context";
import { type ServicePage, servicePages } from "@/features/services/service-pages-content";
import { ServicePriceList } from "@/features/services/service-price-list";
import { ServiceRequestButton } from "@/features/services/service-request-button";

import { getCompany } from "@/lib/api";

const primaryButton =
  "inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white shadow-sm transition hover:bg-blue-700";

export const ServiceLandingPage = ({ page }: { page: ServicePage }) => {
  const { ready, user } = useAuth();
  const companyQuery = useQuery({
    queryKey: ["public-company"],
    queryFn: ({ signal }) => getCompany(signal),
  });
  const company = companyQuery.data?.company;
  const phoneHref = company?.phone?.replace(/[^\d+]/gu, "");
  const otherServices = servicePages.filter((item) => item.slug !== page.slug);
  const Icon = page.icon;

  const content = (
    <>
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-[#26365f]/70">
        <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-16">
          <nav
            aria-label="Хлебные крошки"
            className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400"
          >
            <Link to="/" className="hover:text-blue-700 dark:hover:text-cyan-200">
              Главная
            </Link>
            <span aria-hidden="true">/</span>
            <Link to="/uslugi" className="hover:text-blue-700 dark:hover:text-cyan-200">
              Услуги
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page" className="text-slate-700 dark:text-slate-200">
              {page.navLabel}
            </span>
          </nav>

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <Reveal>
              <div>
                <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
                  {page.eyebrow}
                </p>
                <h1 className="mt-3 max-w-3xl text-3xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-4xl md:text-5xl dark:text-white">
                  {page.heading}
                </h1>
                <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
                  {page.intro}
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ServiceRequestButton className={primaryButton} />
                  {company?.phone && (
                    <a
                      href={`tel:${phoneHref}`}
                      aria-label={`Позвонить в сервис: ${company.phone}`}
                      className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-5 font-semibold text-emerald-800 transition hover:bg-emerald-50 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-300/20"
                    >
                      <Phone size={17} aria-hidden="true" />
                      Позвонить
                    </a>
                  )}
                </div>
                <ul className="mt-6 flex flex-wrap gap-2">
                  {page.facts.map((fact) => (
                    <li
                      key={fact}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-600 dark:border-[#304373] dark:bg-[#0c142b]/70 dark:text-slate-300"
                    >
                      <CheckCircle2
                        size={14}
                        className="shrink-0 text-blue-600 dark:text-cyan-300"
                        aria-hidden="true"
                      />
                      {fact}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <aside className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-7 text-white shadow-[0_24px_70px_rgba(37,99,235,0.18)] sm:p-8 dark:border-cyan-400/20">
                <div className="absolute -top-16 -right-16 size-56 rounded-full border border-white/20" />
                <div className="relative">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                      <Icon size={24} aria-hidden="true" />
                    </span>
                    <RaccoonIcon motion="peek" className="text-2xl" />
                  </div>
                  <h2 className="mt-7 text-2xl leading-tight font-semibold">
                    Понятная смета до начала работ
                  </h2>
                  <ul className="mt-5 grid gap-2.5 text-sm text-blue-50">
                    {[
                      "Диагностика и объяснение причины",
                      "Согласование состава работ и цены",
                      "Гарантия и документы после ремонта",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle2
                          size={17}
                          className="mt-0.5 shrink-0 text-cyan-200"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 rounded-2xl bg-white/10 p-4 text-sm backdrop-blur">
                    <p className="font-semibold">Нужна консультация?</p>
                    {company?.phone ? (
                      <a
                        href={`tel:${phoneHref}`}
                        className="mt-1 inline-flex items-center gap-2 underline"
                      >
                        <Phone size={15} aria-hidden="true" />
                        {company.phone}
                      </a>
                    ) : (
                      <p className="mt-1 text-blue-50">
                        Оставьте заявку — свяжемся и уточним детали.
                      </p>
                    )}
                    <p className="mt-2 flex items-center gap-2 text-blue-100">
                      <Clock3 size={15} aria-hidden="true" />
                      {company?.hours ? `Ежедневно ${company.hours}` : "Ежедневно 8:30–21:30"}
                    </p>
                  </div>
                </div>
              </aside>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Что входит
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Чем поможем</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Точный состав работ определяем после диагностики — лишнего не назначаем.
          </p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {page.includes.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05} className="h-full">
              <article className="h-full rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
                <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                  <CheckCircle2 size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {item.text}
                </p>
              </article>
            </Reveal>
          ))}
        </div>
      </section>

      <section
        id="prices"
        className="scroll-mt-24 border-y border-slate-200/70 bg-white/45 dark:border-[#26365f]/70 dark:bg-[#080e20]/30"
      >
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-12 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <Reveal>
            <div>
              <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
                Цены
              </p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight">Стоимость работ</h2>
              <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {page.priceNotice}
              </p>
              <ServiceRequestButton className={`${primaryButton} mt-6`} />
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <ServicePriceList page={page} />
          </Reveal>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Как проходит ремонт
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Четыре понятных шага</h2>
        </div>
        <ol className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          {page.steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90"
            >
              <span className="text-xs font-bold tracking-[0.16em] text-slate-400 uppercase">
                0{index + 1}
              </span>
              <h3 className="mt-3 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-12 md:px-8">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
              Частые вопросы
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Коротко о важном</h2>
            {page.relatedGuide && (
              <a
                href={page.relatedGuide.href}
                className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline dark:text-cyan-200"
              >
                {page.relatedGuide.title}
                <ArrowRight size={16} aria-hidden="true" />
              </a>
            )}
          </div>
          <div className="grid gap-3">
            {page.faq.map((item) => (
              <details
                key={item.question}
                className="group rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <ChevronDown
                    size={18}
                    className="shrink-0 text-slate-400 transition group-open:rotate-180"
                    aria-hidden="true"
                  />
                </summary>
                <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {item.answer}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200/70 bg-white/45 dark:border-[#26365f]/70 dark:bg-[#080e20]/30">
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <h2 className="text-2xl font-semibold tracking-tight">Другие услуги сервиса</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {otherServices.map((item) => {
              const OtherIcon = item.icon;
              return (
                <Link
                  key={item.slug}
                  to={item.path}
                  className="group rounded-2xl border border-slate-200 bg-white/90 p-5 transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 dark:hover:border-cyan-300/40"
                >
                  <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                    <OtherIcon size={20} aria-hidden="true" />
                  </div>
                  <h3 className="mt-3 font-semibold">{item.navLabel}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                    {item.cardSummary}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 dark:text-cyan-200">
                    Подробнее
                    <ArrowRight
                      size={15}
                      className="transition group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        <div className="flex flex-col gap-5 rounded-[2rem] bg-gradient-to-r from-blue-700 via-blue-600 to-cyan-600 p-6 text-white sm:p-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold">
              Оставьте заявку на {page.navLabel.toLowerCase()}
            </h2>
            <p className="mt-2 text-sm leading-6 text-blue-50">
              Опишите устройство и неисправность. Аккаунт понадобится только при отправке заявки —
              стоимость согласуем до начала работ.
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
