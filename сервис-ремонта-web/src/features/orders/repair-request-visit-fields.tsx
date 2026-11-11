import { useState } from "react";

import type { RepairLocation } from "@/lib/api";

type RepairRequestVisitFieldsProps = {
  repairLocation: RepairLocation;
  onRepairLocationChange: (value: RepairLocation) => void;
  isWithinCity: boolean;
  onWithinCityChange: (value: boolean) => void;
};

const choiceClass = (selected: boolean) =>
  `flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
    selected
      ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
      : "border-slate-200 dark:border-slate-700"
  }`;

export const RepairRequestVisitFields = ({
  repairLocation,
  onRepairLocationChange,
  isWithinCity,
  onWithinCityChange,
}: RepairRequestVisitFieldsProps) => {
  const [distanceKm, setDistanceKm] = useState("");
  const distanceValue = Number(distanceKm);
  const estimatedVisitRub =
    !isWithinCity && Number.isInteger(distanceValue) && distanceValue > 0 ? distanceValue * 25 : 0;

  return (
    <fieldset className="grid gap-3 rounded-2xl border border-slate-200 p-4 md:col-span-2 dark:border-slate-700">
      <legend className="px-1 text-sm font-semibold">Как передать технику</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {(
          [
            [
              "SERVICE_CENTER",
              "Привезу в сервис",
              "Администратор примет технику в сервисном центре.",
            ],
            ["CUSTOMER_ADDRESS", "Нужен выезд мастера", "Мастер приедет по указанному адресу."],
          ] as const
        ).map(([value, title, description]) => (
          <label key={value} className={choiceClass(repairLocation === value)}>
            <input
              type="radio"
              name="repairLocation"
              value={value}
              checked={repairLocation === value}
              onChange={() => onRepairLocationChange(value)}
              className="mt-0.5 size-4 shrink-0 accent-blue-600"
            />
            <span>
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-xs font-normal text-slate-600 dark:text-slate-400">
                {description}
              </span>
            </span>
          </label>
        ))}
      </div>

      {repairLocation === "CUSTOMER_ADDRESS" && (
        <div className="grid gap-3 border-t border-slate-200 pt-3 dark:border-slate-700">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Базовый город — Пушкино Московской области. Внутри Пушкино выезд бесплатный.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                [true, "В пределах Пушкино"],
                [false, "За пределами Пушкино"],
              ] as const
            ).map(([value, label]) => (
              <label key={label} className={choiceClass(isWithinCity === value)}>
                <input
                  type="radio"
                  name="visitArea"
                  value={value ? "within" : "outside"}
                  checked={isWithinCity === value}
                  onChange={() => onWithinCityChange(value)}
                  className="mt-0.5 size-4 shrink-0 accent-blue-600"
                />
                <span className="font-medium">{label}</span>
              </label>
            ))}
          </div>

          {!isWithinCity && (
            <div className="grid gap-2 sm:max-w-xs">
              <label htmlFor="visit-distance" className="text-sm font-medium">
                Примерное расстояние от границы Пушкино, км
              </label>
              <input
                id="visit-distance"
                name="visitCustomerDistanceKm"
                type="number"
                min={1}
                max={10000}
                step={1}
                required
                inputMode="numeric"
                value={distanceKm}
                onChange={(event) => setDistanceKm(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
              {estimatedVisitRub > 0 && (
                <p className="font-semibold text-blue-700 dark:text-blue-300">
                  Предварительно за выезд: {estimatedVisitRub.toLocaleString("ru-RU")} ₽
                </p>
              )}
              <p className="text-xs text-slate-500">
                Предварительно: 25 ₽ за километр в одну сторону. Перед диагностикой мастер или
                администратор вручную сверит расстояние по Яндекс Картам.
              </p>
            </div>
          )}
          {isWithinCity && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Выезд — 0 ₽.
            </p>
          )}
        </div>
      )}

      <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
        Диагностика — 850 ₽ только если мастер её фактически проведёт; плата за загородный выезд
        начисляется только после диагностики. Диагностическая плата и выезд оплачиваются отдельно от
        ремонта и не покрываются бонусами.
      </div>
    </fieldset>
  );
};
