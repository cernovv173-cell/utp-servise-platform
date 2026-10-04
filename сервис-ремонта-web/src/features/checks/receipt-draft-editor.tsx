import { useEffect, useState } from "react";

import type { ReceiptDraft, RepairOrder } from "@/lib/api";

type OrderItem = RepairOrder["items"][number];

const fieldClassName =
  "h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950";

export const ReceiptDraftEditor = ({
  items,
  receiptExists,
  saving,
  onSubmit,
}: {
  items: OrderItem[];
  receiptExists: boolean;
  saving: boolean;
  onSubmit: (draft: ReceiptDraft) => void;
}) => {
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(items.map((item) => [item.id, String(item.quantity)])),
  );
  const [freeSaleType, setFreeSaleType] =
    useState<ReceiptDraft["freeSaleItems"][number]["type"]>("SPARE_PART");
  const [freeSaleName, setFreeSaleName] = useState("");
  const [freeSaleQuantity, setFreeSaleQuantity] = useState("1");
  const [freeSalePrice, setFreeSalePrice] = useState("");

  useEffect(() => {
    setQuantities(Object.fromEntries(items.map((item) => [item.id, String(item.quantity)])));
  }, [items]);

  const freeSaleCount = Number(freeSaleQuantity);
  const freeSaleUnitPrice = Number(freeSalePrice);
  const hasFreeSale = freeSaleName.trim().length > 0;
  const canAddFreeSale =
    !hasFreeSale ||
    (Number.isInteger(freeSaleCount) &&
      freeSaleCount >= 1 &&
      freeSaleCount <= 99 &&
      Number.isInteger(freeSaleUnitPrice) &&
      freeSaleUnitPrice >= 1 &&
      freeSaleUnitPrice <= 2_147_483_647);
  const canSubmit =
    canAddFreeSale &&
    items.every((item) => {
      const quantity = Number(quantities[item.id]);
      return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;
    });

  const submit = () => {
    if (!canSubmit) return;
    onSubmit({
      itemQuantities: items.map((item) => ({
        itemId: item.id,
        quantity: Number(quantities[item.id]),
      })),
      freeSaleItems: hasFreeSale
        ? [
            {
              type: freeSaleType,
              name: freeSaleName.trim(),
              quantity: freeSaleCount,
              unitPriceRub: freeSaleUnitPrice,
            },
          ]
        : [],
    });
  };

  const total =
    items.reduce((sum, item) => sum + (Number(quantities[item.id]) || 0) * item.unitPriceRub, 0) +
    (hasFreeSale && canAddFreeSale ? freeSaleCount * freeSaleUnitPrice : 0);

  return (
    <section className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/30 print:hidden">
      <h3 className="font-semibold">{receiptExists ? "Изменить состав чека" : "Состав чека"}</h3>
      <p className="mt-1 text-xs text-slate-500">
        Количество в чеке обновит заказ, бонусный расчёт и начисление за услуги. Оплаченный чек
        изменить нельзя.
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <label
            key={item.id}
            className="grid items-center gap-2 rounded-lg bg-white p-3 text-sm sm:grid-cols-[minmax(0,1fr)_100px] dark:bg-slate-900"
          >
            <span>
              {item.name} · {item.unitPriceRub.toLocaleString("ru-RU")} ₽/шт.
            </span>
            <span className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Кол-во</span>
              <input
                aria-label={`Количество: ${item.name}`}
                type="number"
                min={1}
                max={99}
                step={1}
                value={quantities[item.id] ?? ""}
                onChange={(event) =>
                  setQuantities((current) => ({
                    ...current,
                    [item.id]: event.target.value,
                  }))
                }
                className={`${fieldClassName} w-20`}
              />
            </span>
          </label>
        ))}
      </div>

      <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 dark:border-slate-700">
        <h4 className="text-sm font-semibold">Свободная продажа</h4>
        <p className="mt-1 text-xs text-slate-500">
          Добавьте отдельную позицию с произвольным названием и ценой.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm font-medium sm:col-span-2">
            Название позиции
            <input
              value={freeSaleName}
              onChange={(event) => setFreeSaleName(event.target.value)}
              maxLength={160}
              className={fieldClassName}
            />
          </label>
          <fieldset className="grid gap-1 text-sm font-medium">
            <legend>Тип позиции</legend>
            <div className="flex gap-2">
              {(
                [
                  ["SPARE_PART", "Товар / запчасть"],
                  ["SERVICE", "Услуга"],
                ] as const
              ).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={freeSaleType === type}
                  onClick={() => setFreeSaleType(type)}
                  className={`min-h-10 rounded-lg border px-3 text-sm ${freeSaleType === type ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 dark:border-slate-700"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="grid gap-1 text-sm font-medium">
            Количество
            <input
              type="number"
              min={1}
              max={99}
              step={1}
              value={freeSaleQuantity}
              onChange={(event) => setFreeSaleQuantity(event.target.value)}
              className={fieldClassName}
            />
          </label>
          <label className="grid gap-1 text-sm font-medium">
            Цена за единицу, ₽
            <input
              type="number"
              min={1}
              max={2147483647}
              step={1}
              value={freeSalePrice}
              onChange={(event) => setFreeSalePrice(event.target.value)}
              className={fieldClassName}
            />
          </label>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          Предварительный итог: {total.toLocaleString("ru-RU")} ₽
        </p>
        <button
          type="button"
          disabled={!canSubmit || saving}
          onClick={submit}
          className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? "Сохраняем…" : receiptExists ? "Обновить чек" : "Создать чек"}
        </button>
      </div>
    </section>
  );
};
