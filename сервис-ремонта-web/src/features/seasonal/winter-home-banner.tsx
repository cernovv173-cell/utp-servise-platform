import { CheckCircle2, Snowflake } from "lucide-react";

const winterBenefits = [
  "Диагностика до начала работ",
  "Связь с сервисом в аккаунте",
  "Чек и гарантия после ремонта",
];

export const WinterHomeBanner = ({ className = "" }: { className?: string }) => (
  <section
    aria-label="Зимнее оформление ЕНОТ СЕРВИС"
    className={`relative isolate flex min-h-[230px] overflow-hidden rounded-[2rem] border border-amber-100/30 bg-[#10203a] p-6 text-white shadow-[0_24px_70px_rgba(15,35,63,0.2)] sm:min-h-[260px] sm:p-8 ${className}`}
  >
    <img
      src="/images/new-year-raccoon.webp"
      alt=""
      aria-hidden="true"
      loading="eager"
      decoding="async"
      className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
    />
    <div className="absolute inset-0 bg-gradient-to-r from-[#0b1830] via-[#0b1830]/90 to-[#0b1830]/10" />
    <div className="absolute inset-0 bg-gradient-to-t from-[#0b1830]/55 via-transparent to-[#0b1830]/10" />
    <div className="relative z-10 flex max-w-[70%] flex-col justify-center">
      <div className="mb-3 flex items-center gap-2">
        <img
          src="/images/new-year-snowman.webp"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="size-8 shrink-0 rounded-xl border border-white/35 bg-[#eaf4ff] object-cover shadow-sm"
        />
        <p className="flex items-center gap-1 text-[9px] font-bold tracking-[0.12em] text-amber-200 uppercase sm:text-xs">
          <Snowflake size={14} aria-hidden="true" />
          Зимнее настроение
        </p>
        <img
          src="/images/new-year-tree.webp"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="size-8 shrink-0 rounded-xl border border-white/35 bg-[#eaf4ff] object-cover shadow-sm"
        />
      </div>
      <h2 className="max-w-sm text-xl leading-tight font-semibold sm:text-2xl">
        Пусть в новом году техника работает без сбоев.
      </h2>
      <div className="mt-4 grid gap-2 text-xs text-blue-50 sm:text-sm">
        {winterBenefits.map((item) => (
          <p key={item} className="flex items-center gap-2">
            <CheckCircle2 size={15} className="shrink-0 text-amber-200" aria-hidden="true" />
            {item}
          </p>
        ))}
      </div>
    </div>
  </section>
);
