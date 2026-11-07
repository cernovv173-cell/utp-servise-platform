import { useState } from "react";

import type { CustomerServicePrice, RepairDeviceType } from "@/lib/api";

type PreVisitPriceGuideProps = {
  prices: CustomerServicePrice[];
  deviceType: string;
  isLoading: boolean;
  isError: boolean;
};

const priceLabel = (price: CustomerServicePrice) =>
  `${price.unitPriceRub.toLocaleString("ru-RU")} ₽`;

const isVisitPrice = (price: CustomerServicePrice) =>
  price.name.toLocaleLowerCase("ru-RU").startsWith("вызов к заказчику");

const isMatchingDiagnostic = (price: CustomerServicePrice, deviceType: string) => {
  const name = price.name.toLocaleLowerCase("ru-RU");
  return (
    name.startsWith("диагностика") &&
    (deviceType === "COMPUTER"
      ? name.includes("пк") || name.includes("комплектующ")
      : deviceType === "LAPTOP"
        ? name.includes("ноутбук")
        : false)
  );
};

const PriceRows = ({ prices }: { prices: CustomerServicePrice[] }) => (
  <ul className="grid gap-2">
    {prices.map((price) => (
      <li
        key={price.id}
        className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-blue-100 py-2 last:border-0 dark:border-blue-900"
      >
        <span className="text-sm text-slate-700 dark:text-slate-200">{price.name}</span>
        <span className="shrink-0 text-sm font-semibold text-slate-950 dark:text-white">
          {priceLabel(price)}
        </span>
      </li>
    ))}
  </ul>
);

export const PreVisitPriceGuide = ({
  prices,
  deviceType,
  isLoading,
  isError,
}: PreVisitPriceGuideProps) => {
  const [expanded, setExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const devicePrices = prices.filter((price) =>
    price.deviceTypes.includes(deviceType as RepairDeviceType),
  );
  const visitPrices = devicePrices.filter(isVisitPrice);
  const diagnosticPrices = devicePrices.filter((price) => isMatchingDiagnostic(price, deviceType));
  const featuredPrices = [...visitPrices, ...diagnosticPrices].filter(
    (price, index, all) => all.findIndex(({ id }) => id === price.id) === index,
  );
  const matchingPrices = devicePrices.filter((price) =>
    price.name.toLocaleLowerCase("ru-RU").includes(search.trim().toLocaleLowerCase("ru-RU")),
  );

  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900 dark:bg-emerald-950/25">
      <h3 className="font-semibold text-emerald-950 dark:text-emerald-100">
        Ориентиры по прайсу до выезда
      </h3>
      <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
        Показаны действующие цены только на конкретные услуги из прайса сервиса. Это не диагноз и не
        обещание, что выбранная работа подойдёт именно вашей неисправности.
      </p>

      {isLoading ? (
        <p className="mt-3 text-sm text-slate-500">Загружаем актуальный прайс…</p>
      ) : isError ? (
        <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">
          Не удалось загрузить прайс. Мы не показываем приблизительные цены вместо действующих
          тарифов.
        </p>
      ) : devicePrices.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          В прайсе пока нет активных тарифов для показа.
        </p>
      ) : (
        <>
          {featuredPrices.length > 0 ? (
            <div className="mt-3 rounded-lg bg-white/80 px-3 dark:bg-slate-900/70">
              <PriceRows prices={featuredPrices} />
            </div>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              Для этого типа устройства в прайсе нет отдельной позиции диагностики. Ниже можно
              посмотреть остальные работы.
            </p>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-600 dark:text-slate-300">
            Выезд, диагностика, ремонт и запчасти не складываются здесь в предполагаемый итог:
            необходимость каждой позиции и условия оплаты выезда сервис уточнит отдельно.
          </p>
          <button
            type="button"
            aria-expanded={expanded}
            onClick={() => setExpanded((value) => !value)}
            className="mt-3 min-h-9 rounded-lg border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-slate-900 dark:text-emerald-100"
          >
            {expanded ? "Скрыть полный прайс" : "Найти конкретную работу в прайсе"}
          </button>
          {expanded && (
            <div className="mt-3 grid gap-3">
              <label className="grid gap-1.5 text-xs font-medium">
                Поиск по услугам
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Например, замена матрицы"
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
              {matchingPrices.length > 0 ? (
                <div className="max-h-72 overflow-y-auto rounded-lg bg-white/80 px-3 dark:bg-slate-900/70">
                  <PriceRows prices={matchingPrices} />
                </div>
              ) : (
                <p className="text-sm text-slate-500">Подходящих действующих услуг не найдено.</p>
              )}
            </div>
          )}
        </>
      )}

      <p className="mt-3 rounded-lg bg-white/80 p-3 text-xs leading-5 font-medium text-slate-700 dark:bg-slate-900/70 dark:text-slate-200">
        После осмотра мастер подготовит точную смету с работами и деталями. Администратор проверит
        её до начала ремонта и сообщит вам состав и стоимость работ.
      </p>
    </section>
  );
};
