import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Eye,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { PublicSiteShell, repairRequestHref } from "@/components/public-site-shell";
import { RaccoonIcon } from "@/components/raccoon-icon";

import { HomeReviewShowcase } from "@/features/public/home-review-showcase";

import { getCompany } from "@/lib/api";

const defaultServices = [
  "Диагностика компьютеров и ноутбуков",
  "Ремонт компьютеров, ноутбуков, телефонов и планшетов",
  "Настройка, профилактика и замена комплектующих",
];

const steps = [
  {
    icon: ClipboardList,
    title: "Оставьте заявку",
    description: "Опишите устройство и неисправность. Регистрация нужна только на этом шаге.",
  },
  {
    icon: Wrench,
    title: "Получите диагностику",
    description: "Мастер уточнит детали и сообщит, что потребуется для ремонта.",
  },
  {
    icon: CheckCircle2,
    title: "Следите за результатом",
    description: "Статус ремонта, сообщения и история обращения сохраняются в аккаунте.",
  },
];

const trustPoints = [
  {
    icon: Eye,
    title: "Каждый этап на виду",
    description: "В личном кабинете доступны статус ремонта, сообщения и история обращения.",
  },
  {
    icon: ClipboardCheck,
    title: "Работы зафиксированы",
    description: "В чеках и сервисных номерах можно посмотреть заказ и состав выполненных работ.",
  },
  {
    icon: BadgeCheck,
    title: "Гарантия оформлена",
    description: "После выдачи заказа в аккаунте формируется гарантийный талон с данными ремонта.",
  },
];

export const PublicHome = () => {
  const companyQuery = useQuery({
    queryKey: ["public-company"],
    queryFn: ({ signal }) => getCompany(signal),
  });
  const company = companyQuery.data?.company;
  const services = company?.services.length ? company.services : defaultServices;
  const serviceName = company?.name ?? "UTP Servise";

  return (
    <PublicSiteShell>
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-[#26365f]/70">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 md:px-8 md:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold tracking-[0.16em] text-blue-700 uppercase dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200">
              <RaccoonIcon motion="peek" className="text-sm" />
              Сервис ремонта техники
            </p>
            <h1 className="mt-6 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl dark:text-white">
              Ремонт компьютеров и ноутбуков — понятно и без лишних шагов.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-600 md:text-lg dark:text-slate-300">
              {company?.description ||
                "Помогаем вернуть технику к работе, объясняем этапы ремонта и остаёмся на связи."}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href={repairRequestHref}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white shadow-[0_10px_28px_rgba(37,99,235,0.22)] hover:bg-blue-700"
              >
                Оформить заявку <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a
                href="#services"
                className="inline-flex min-h-12 items-center rounded-xl border border-slate-200 bg-white/80 px-5 font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#304373] dark:bg-[#0c142b]/70 dark:text-slate-200 dark:hover:bg-[#152449]"
              >
                Посмотреть услуги
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Сайт открыт для просмотра. Аккаунт понадобится только при отправке заявки.
            </p>
          </div>
          <div className="relative">
            <div className="absolute -inset-8 rounded-[3rem] bg-blue-400/10 blur-3xl dark:bg-cyan-400/10" />
            <div className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-7 text-white shadow-[0_24px_70px_rgba(37,99,235,0.22)] sm:p-9">
              <div className="absolute -top-16 -right-16 size-56 rounded-full border border-white/20" />
              <div className="absolute -right-2 -bottom-24 size-64 rounded-full border border-white/15" />
              <div className="relative">
                <div className="flex items-center justify-between gap-4">
                  <div className="grid size-14 place-items-center rounded-2xl bg-white/15 text-2xl backdrop-blur">
                    <RaccoonIcon motion="bounce" />
                  </div>
                  <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-blue-50">
                    {serviceName}
                  </span>
                </div>
                <h2 className="mt-12 max-w-md text-3xl leading-tight font-semibold">
                  Ваша техника снова в строю.
                </h2>
                <div className="mt-8 grid gap-3 text-sm text-blue-50">
                  {[
                    "Понятная заявка без звонков",
                    "Связь с сервисом в аккаунте",
                    "История ремонта всегда под рукой",
                  ].map((item) => (
                    <p key={item} className="flex items-center gap-2">
                      <CheckCircle2 size={17} className="shrink-0 text-cyan-200" />
                      {item}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Что мы делаем
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Услуги сервиса</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Выберите удобный способ связаться с нами — подробности можно указать уже в заявке.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {services.slice(0, 6).map((service, index) => (
            <article
              key={service}
              className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/85"
            >
              <div className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                {index === 0 ? <ShieldCheck size={21} /> : <Wrench size={21} />}
              </div>
              <h3 className="mt-4 font-semibold">{service}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                Окончательный состав работ определяется после диагностики.
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200/70 bg-white/45 dark:border-[#26365f]/70 dark:bg-[#080e20]/30">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
              Как всё проходит
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Три понятных шага</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white/85 p-5 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/85"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-blue-700 dark:bg-[#17264b] dark:text-cyan-200">
                    <Icon size={21} />
                  </div>
                  <span className="text-xs font-bold tracking-[0.16em] text-slate-400 uppercase">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-5 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="trust" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-16 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Для клиентов
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">Нам доверяют</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Понятные этапы ремонта и документы помогают вам видеть, что происходит с техникой.
          </p>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {trustPoints.map(({ icon: Icon, title, description }) => (
            <article
              key={title}
              className="rounded-2xl border border-slate-200 bg-white/85 p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/85"
            >
              <div className="grid size-11 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                <Icon size={21} aria-hidden="true" />
              </div>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                {description}
              </p>
            </article>
          ))}
        </div>
      </section>

      <HomeReviewShowcase />

      <section className="mx-auto max-w-7xl px-4 py-16 md:px-8">
        <div className="grid gap-5 rounded-[2rem] border border-blue-100 bg-blue-50/75 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center dark:border-cyan-400/20 dark:bg-[#0d1b38]/80">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-blue-700 dark:text-cyan-200">
              <Clock3 size={17} />
              Регистрация только по делу
            </div>
            <h2 className="mt-3 text-2xl font-semibold">Нужно починить технику?</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              Создайте аккаунт при оформлении заявки. После этого в личном кабинете будут доступны
              статус ремонта, переписка и история обращений.
            </p>
          </div>
          <a
            href={repairRequestHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
          >
            Начать заявку <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </section>
    </PublicSiteShell>
  );
};
