import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Wrench,
} from "lucide-react";

import { PublicSiteShell, repairRequestHref } from "@/components/public-site-shell";
import { RaccoonIcon } from "@/components/raccoon-icon";

import { CustomerOfferHomeBanners } from "@/features/campaigns/customer-offer-home-banners";
import { GuidesSection } from "@/features/guides/guides-section";
import { HomeReviewShowcase } from "@/features/public/home-review-showcase";
import { ServicePriceTicker } from "@/features/public/service-price-ticker";

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
    description:
      "Опишите устройство и неисправность. Аккаунт понадобится только для отправки заявки.",
  },
  {
    icon: Wrench,
    title: "Согласуйте ремонт",
    description:
      "Мастер проведёт диагностику и сообщит состав и стоимость работ до начала ремонта.",
  },
  {
    icon: CheckCircle2,
    title: "Следите за результатом",
    description: "Статус, переписка, документы и история обращения останутся в вашем аккаунте.",
  },
];

export const PublicHome = () => {
  const companyQuery = useQuery({
    queryKey: ["public-company"],
    queryFn: ({ signal }) => getCompany(signal),
  });
  const company = companyQuery.data?.company;
  const services = (company?.services.length ? company.services : defaultServices).slice(0, 3);
  const serviceName = company?.name ?? "UTP Servise";

  return (
    <PublicSiteShell>
      <section className="relative overflow-hidden border-b border-slate-200/70 dark:border-[#26365f]/70">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:px-8 md:py-20 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold tracking-[0.16em] text-blue-700 uppercase dark:border-cyan-400/30 dark:bg-cyan-400/10 dark:text-cyan-200">
              <RaccoonIcon motion="peek" className="text-sm" />
              Сервис ремонта техники
            </p>
            <h1 className="mt-5 max-w-3xl text-4xl leading-tight font-semibold tracking-tight text-slate-950 sm:text-5xl dark:text-white">
              Ремонт техники — понятно и без лишних шагов.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-slate-300">
              {company?.description ||
                "Помогаем вернуть технику к работе, объясняем этапы ремонта и остаёмся на связи."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={repairRequestHref}
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Оформить заявку <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a
                href="#services"
                className="inline-flex min-h-12 items-center rounded-xl border border-slate-200 bg-white/80 px-5 font-semibold text-slate-700 hover:bg-slate-100 dark:border-[#304373] dark:bg-[#0c142b]/70 dark:text-slate-200 dark:hover:bg-[#152449]"
              >
                Услуги сервиса
              </a>
              {company?.phone && (
                <a
                  href={`tel:${company.phone.replace(/[^\d+]/gu, "")}`}
                  aria-label={`Позвонить в сервис: ${company.phone}`}
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-emerald-200 bg-white/80 px-5 font-semibold text-emerald-800 hover:bg-emerald-50 dark:border-emerald-300/30 dark:bg-emerald-400/10 dark:text-emerald-100 dark:hover:bg-emerald-300/20"
                >
                  <Phone size={17} aria-hidden="true" />
                  Позвонить
                </a>
              )}
            </div>
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              {serviceName} · аккаунт понадобится только при отправке заявки.
            </p>
          </div>
          <div className="relative overflow-hidden rounded-[2rem] border border-blue-100 bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-7 text-white shadow-[0_24px_70px_rgba(37,99,235,0.18)] sm:p-9">
            <div className="absolute -top-16 -right-16 size-56 rounded-full border border-white/20" />
            <div className="relative">
              <div className="grid size-14 place-items-center rounded-2xl bg-white/15 text-2xl backdrop-blur">
                <RaccoonIcon motion="bounce" />
              </div>
              <h2 className="mt-10 max-w-md text-3xl leading-tight font-semibold">
                Вы знаете, что происходит с вашей техникой.
              </h2>
              <div className="mt-7 grid gap-3 text-sm text-blue-50">
                {[
                  "Диагностика до начала работ",
                  "Связь с сервисом в аккаунте",
                  "Чек и гарантия после ремонта",
                ].map((item) => (
                  <p key={item} className="flex items-center gap-2">
                    <CheckCircle2 size={17} className="shrink-0 text-cyan-200" aria-hidden="true" />
                    {item}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <CustomerOfferHomeBanners />
      <ServicePriceTicker />

      <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 md:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
            Услуги сервиса
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">Чем можем помочь</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Точный состав и стоимость работ согласуем после диагностики.
          </p>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {services.map((service, index) => {
            const Icon = index === 0 ? ShieldCheck : Wrench;
            return (
              <article
                key={service}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90"
              >
                <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
                  <Icon size={20} aria-hidden="true" />
                </div>
                <h3 className="mt-3 font-semibold">{service}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  Стоимость сообщим до начала ремонта.
                </p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        id="steps"
        className="border-y border-slate-200/70 bg-white/45 dark:border-[#26365f]/70 dark:bg-[#080e20]/30"
      >
        <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-cyan-300">
              Как всё проходит
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight">Три понятных шага</h2>
          </div>
          <div className="mt-6 grid gap-3 lg:grid-cols-3">
            {steps.map(({ icon: Icon, title, description }, index) => (
              <article
                key={title}
                className="rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90"
              >
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-cyan-200">
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <span className="text-xs font-bold tracking-[0.16em] text-slate-400 uppercase">
                    0{index + 1}
                  </span>
                </div>
                <h3 className="mt-4 font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <GuidesSection />

      <HomeReviewShowcase />

      <section id="contacts" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-12 md:px-8">
        <div className="grid gap-5 rounded-[2rem] border border-blue-100 bg-blue-50/75 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center dark:border-cyan-400/20 dark:bg-[#0d1b38]/80">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-blue-700 uppercase dark:text-cyan-200">
              Контакты
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Свяжитесь с сервисом</h2>
            <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-300">
              {company?.phone && (
                <a href={`tel:${company.phone}`} className="flex items-center gap-2">
                  <Phone size={16} aria-hidden="true" /> {company.phone}
                </a>
              )}
              {company?.email && (
                <a href={`mailto:${company.email}`} className="flex items-center gap-2">
                  <Mail size={16} aria-hidden="true" /> {company.email}
                </a>
              )}
              {company?.address && (
                <p className="flex items-start gap-2 sm:col-span-2">
                  <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{" "}
                  {company.address}
                </p>
              )}
              {company?.hours && (
                <p className="flex items-start gap-2 sm:col-span-2">
                  <Clock3 size={16} className="mt-0.5 shrink-0" aria-hidden="true" />{" "}
                  {company.hours}
                </p>
              )}
            </div>
          </div>
          <a
            href={repairRequestHref}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
          >
            Оформить заявку <ArrowRight size={18} aria-hidden="true" />
          </a>
        </div>
      </section>
    </PublicSiteShell>
  );
};
