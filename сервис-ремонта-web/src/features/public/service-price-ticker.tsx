import { useQuery } from "@tanstack/react-query";
import { BadgeRussianRuble, Pause, Play } from "lucide-react";
import { useState } from "react";

import { pickHomeServicePrices } from "@/features/public/service-price-selection";

import { getCustomerServicePrices, getPublicServicePrices } from "@/lib/api";

const formatRub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

export const ServicePriceTicker = ({ token }: { token?: string | null }) => {
  const pricesQuery = useQuery({
    queryKey: token ? ["customer-service-prices", token] : ["public-service-prices"],
    queryFn: ({ signal }) =>
      token ? getCustomerServicePrices(token, signal) : getPublicServicePrices(signal),
  });
  const [paused, setPaused] = useState<boolean | null>(null);
  const prices = pickHomeServicePrices(pricesQuery.data?.prices ?? []);

  if (prices.length === 0) return null;

  const copies = prices.length < 6 ? 4 : 2;
  const loopedPrices = Array.from({ length: copies }, () => prices).flat();
  const animationDuration = Math.max(48, prices.length * 6);
  const isPaused = paused === true;

  return (
    <section
      aria-labelledby="home-service-prices-title"
      className="price-ticker border-b border-slate-200/70 bg-white/65 dark:border-[#26365f]/70 dark:bg-[#080e20]/45"
    >
      <div className="mx-auto flex max-w-7xl flex-col gap-2.5 px-4 py-4 md:flex-row md:items-center md:gap-5 md:px-8">
        <div className="flex items-center gap-3">
          <div className="flex min-w-0 flex-1 items-center gap-2.5 md:flex-none">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-cyan-200">
              <BadgeRussianRuble size={18} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2
                id="home-service-prices-title"
                className="text-xs font-bold tracking-[0.16em] text-blue-700 uppercase dark:text-cyan-200"
              >
                Цены на работы
              </h2>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">
                Из действующего прайса · итог после диагностики
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPaused((value) => value !== true)}
            aria-pressed={isPaused}
            aria-label={
              isPaused
                ? "Продолжить автоматическую прокрутку цен"
                : "Остановить автоматическую прокрутку цен"
            }
            title={isPaused ? "Продолжить прокрутку" : "Остановить прокрутку"}
            className="grid size-8 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white/70 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 dark:border-[#304373] dark:bg-[#0c142b]/70 dark:text-slate-400 dark:hover:bg-[#152449]"
          >
            {isPaused ? (
              <Play size={14} aria-hidden="true" />
            ) : (
              <Pause size={14} aria-hidden="true" />
            )}
          </button>
        </div>
        <div className="price-ticker-viewport min-w-0 flex-1 overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_4%,black_96%,transparent)]">
          <ul
            className="price-ticker-track flex w-max items-center"
            style={{
              animationDuration: `${animationDuration}s`,
              animationPlayState: paused === null ? undefined : paused ? "paused" : "running",
            }}
          >
            {loopedPrices.map((price, index) => {
              const isDuplicate = index >= prices.length;
              return (
                <li
                  key={`${price.id}-${index}`}
                  aria-hidden={isDuplicate || undefined}
                  data-ticker-duplicate={isDuplicate ? "true" : undefined}
                  className="mr-2 flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-3.5 py-1.5 text-sm shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90"
                >
                  <span className="text-slate-600 dark:text-slate-300">{price.name}</span>
                  <span className="font-semibold text-slate-950 tabular-nums dark:text-white">
                    {formatRub(price.unitPriceRub)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
};
