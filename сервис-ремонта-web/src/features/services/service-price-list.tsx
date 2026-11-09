import { useQuery } from "@tanstack/react-query";

import type { ServicePage } from "@/features/services/service-pages-content";

import { getPublicServicePrices } from "@/lib/api";

const formatRub = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

export const ServicePriceList = ({ page }: { page: ServicePage }) => {
  const query = useQuery({
    queryKey: ["public-service-prices"],
    queryFn: ({ signal }) => getPublicServicePrices(signal),
    staleTime: 60_000,
  });

  const prices = query.data?.prices ?? [];
  const rows = page.priceItems.flatMap((item) => {
    const catalogItem = prices.find((price) => price.name === item.name);
    if (!catalogItem || catalogItem.unitPriceRub <= 0) return [];
    return [{ ...item, priceRub: catalogItem.unitPriceRub }];
  });

  if (query.isLoading) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-slate-200 bg-white/90 p-6 text-sm text-slate-500 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 dark:text-slate-400"
      >
        Загружаем цены из прайса…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 text-sm leading-6 text-amber-900 dark:border-amber-300/30 dark:bg-amber-400/10 dark:text-amber-100">
        Прайс сейчас недоступен. Стоимость уточним по телефону или в заявке — до начала работ.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
      <table className="w-full text-sm">
        <caption className="sr-only">Стоимость работ: {page.navLabel}</caption>
        <thead className="bg-slate-50 text-left text-xs font-bold tracking-[0.12em] text-slate-500 uppercase dark:bg-[#101a34] dark:text-slate-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-bold">
              Работа
            </th>
            <th scope="col" className="px-4 py-3 text-right font-bold">
              Стоимость
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-[#26365f]">
          {rows.map((row) => (
            <tr key={row.name}>
              <th scope="row" className="px-4 py-3 text-left font-medium">
                {row.name}
              </th>
              <td className="px-4 py-3 text-right font-semibold whitespace-nowrap">
                {formatRub(row.priceRub)}
                {row.unit ? (
                  <span className="ml-1 text-xs font-normal text-slate-500 dark:text-slate-400">
                    {row.unit}
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
