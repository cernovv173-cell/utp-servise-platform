import { ArrowUpRight } from "lucide-react";

const VK_COMMUNITY_URL = "https://vk.ru/remont_pk_puhkino";

export const VkCommunityCard = () => (
  <section className="mx-auto max-w-7xl px-4 py-8 md:px-8" aria-labelledby="vk-community-title">
    <div className="grid items-center gap-5 rounded-[2rem] border border-slate-200 bg-white/85 p-5 shadow-sm sm:grid-cols-[auto_1fr_auto] sm:p-7 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/85">
      <img
        src="/images/enot-brand-logo.jpg"
        alt=""
        loading="lazy"
        className="size-16 rounded-2xl border border-slate-200 object-cover shadow-sm dark:border-[#304373]"
      />
      <div>
        <p className="text-xs font-bold tracking-[0.18em] text-blue-700 uppercase dark:text-cyan-300">
          ЕНОТ СЕРВИС · ВКонтакте
        </p>
        <h2 id="vk-community-title" className="mt-1 text-xl font-semibold tracking-tight">
          Мы в сообществе ВК
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          Новости сервиса, полезные советы и объявления — загляните в нашу группу.
        </p>
      </div>
      <a
        href={VK_COMMUNITY_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Открыть сообщество Енот-Сервис во ВКонтакте в новой вкладке"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        Открыть группу <ArrowUpRight size={17} aria-hidden="true" />
      </a>
    </div>
  </section>
);
