import { MapPin, Minus, Plus, ShoppingBag, ShoppingCart } from "lucide-react";

import { SectionCard } from "@/components/app-shell";
import { PublicAuthTrigger } from "@/components/public-site-shell";

import type { ShopProductAvailability } from "@/lib/api";

import { formatShopRub } from "./shop-format";

export type ShopCheckoutLine = {
  key: string;
  title: string;
  unitPriceRub: number;
  quantity: number;
  availability: ShopProductAvailability;
  availableQuantity: number | null;
};

export const ShopCheckoutPanel = ({
  lines,
  cartCount,
  subtotal,
  hasUnavailableItem,
  hasUnresolvedCartItems,
  canOrder,
  busy,
  deliveryMethod,
  onDeliveryMethodChange,
  deliveryCity,
  onDeliveryCityChange,
  deliveryAddress,
  onDeliveryAddressChange,
  deliveryRequestNote,
  onDeliveryRequestNoteChange,
  customerNote,
  onCustomerNoteChange,
  onSetQuantity,
  onSubmit,
}: {
  lines: ShopCheckoutLine[];
  cartCount: number;
  subtotal: number;
  hasUnavailableItem: boolean;
  hasUnresolvedCartItems: boolean;
  canOrder: boolean;
  busy: boolean;
  deliveryMethod: "PICKUP" | "COURIER";
  onDeliveryMethodChange: (method: "PICKUP" | "COURIER") => void;
  deliveryCity: string;
  onDeliveryCityChange: (value: string) => void;
  deliveryAddress: string;
  onDeliveryAddressChange: (value: string) => void;
  deliveryRequestNote: string;
  onDeliveryRequestNoteChange: (value: string) => void;
  customerNote: string;
  onCustomerNoteChange: (value: string) => void;
  onSetQuantity: (key: string, quantity: number) => void;
  onSubmit: () => void;
}) => (
  <section aria-labelledby="shop-cart-heading" className="lg:sticky lg:top-24">
    <SectionCard>
      <div className="flex items-center gap-2">
        <ShoppingCart size={20} className="text-blue-600 dark:text-cyan-300" aria-hidden="true" />
        <h2 id="shop-cart-heading" className="font-semibold">
          Корзина
        </h2>
        <span className="ml-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold tabular-nums dark:bg-slate-800">
          {cartCount}
        </span>
      </div>
      {hasUnresolvedCartItems && (
        <p role="alert" className="mt-3 text-sm leading-5 text-rose-600">
          Не все позиции корзины удалось загрузить. Обновите каталог; заказ пока нельзя отправить,
          корзина сохранится.
        </p>
      )}
      {lines.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          {hasUnresolvedCartItems
            ? "Корзина содержит позиции, данные которых ещё не загружены."
            : "Добавьте товары или готовые изделия ручной работы."}
        </p>
      ) : (
        <>
          <ul className="mt-4 grid gap-3">
            {lines.map((line) => (
              <li
                key={line.key}
                className="border-b border-slate-100 pb-3 last:border-0 dark:border-slate-800"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{line.title}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatShopRub(line.unitPriceRub)} за штуку
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatShopRub(line.unitPriceRub * line.quantity)}
                  </p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Уменьшить количество: ${line.title}`}
                    onClick={() => onSetQuantity(line.key, line.quantity - 1)}
                    className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Minus size={14} aria-hidden="true" />
                  </button>
                  <span className="min-w-6 text-center text-sm tabular-nums">{line.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Увеличить количество: ${line.title}`}
                    disabled={line.quantity >= (line.availableQuantity ?? 100)}
                    onClick={() => onSetQuantity(line.key, line.quantity + 1)}
                    className="grid size-8 place-items-center rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Plus size={14} aria-hidden="true" />
                  </button>
                  {line.availability === "OUT_OF_STOCK" && (
                    <span className="ml-1 text-xs text-rose-600">Нет в наличии</span>
                  )}
                  {line.availableQuantity !== null && line.quantity > line.availableQuantity && (
                    <span className="ml-1 text-xs text-rose-600">
                      Доступно {line.availableQuantity} шт.
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          <fieldset className="mt-4 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
            <legend className="px-1 text-sm font-semibold">Получение заказа</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["PICKUP", "Самовывоз"],
                  ["COURIER", "Доставка"],
                ] as const
              ).map(([method, label]) => (
                <label
                  key={method}
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-medium ${deliveryMethod === method ? "border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-cyan-200" : "border-slate-200 dark:border-slate-700"}`}
                >
                  <input
                    type="radio"
                    name="shop-delivery-method"
                    value={method}
                    checked={deliveryMethod === method}
                    onChange={() => onDeliveryMethodChange(method)}
                    className="accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            {deliveryMethod === "COURIER" && (
              <div className="mt-4 grid gap-3">
                <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                  Самовывоз — из Пушкино. Курьер — по Пушкино и ближайшему Подмосковью.
                  Администратор проверит адрес и вручную предложит стоимость и срок; заказ
                  подтвердится только после вашего согласия.
                </p>
                <p className="flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-cyan-100">
                  <MapPin size={16} aria-hidden="true" />
                  Московская область
                </p>
                <label className="grid gap-1 text-sm font-medium" htmlFor="shop-delivery-city">
                  Населённый пункт <span aria-hidden="true">*</span>
                  <input
                    id="shop-delivery-city"
                    value={deliveryCity}
                    onChange={(event) => onDeliveryCityChange(event.target.value.slice(0, 120))}
                    autoComplete="address-level2"
                    maxLength={120}
                    required
                    placeholder="Пушкино"
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium" htmlFor="shop-delivery-address">
                  Улица, дом и квартира <span aria-hidden="true">*</span>
                  <input
                    id="shop-delivery-address"
                    value={deliveryAddress}
                    onChange={(event) => onDeliveryAddressChange(event.target.value.slice(0, 500))}
                    autoComplete="street-address"
                    maxLength={500}
                    required
                    placeholder="Улица, дом, квартира"
                    className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
                <label
                  className="grid gap-1 text-sm font-medium"
                  htmlFor="shop-delivery-request-note"
                >
                  Пожелания по доставке{" "}
                  <span className="font-normal text-slate-500">(необязательно)</span>
                  <textarea
                    id="shop-delivery-request-note"
                    value={deliveryRequestNote}
                    onChange={(event) =>
                      onDeliveryRequestNoteChange(event.target.value.slice(0, 500))
                    }
                    maxLength={500}
                    rows={2}
                    placeholder="Домофон или удобный интервал"
                    className="resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
                  />
                </label>
              </div>
            )}
          </fieldset>
          <label className="mt-4 block text-sm font-medium" htmlFor="shop-customer-note">
            Комментарий администратору{" "}
            <span className="font-normal text-slate-500">(необязательно)</span>
          </label>
          <textarea
            id="shop-customer-note"
            value={customerNote}
            onChange={(event) => onCustomerNoteChange(event.target.value.slice(0, 1000))}
            maxLength={1000}
            rows={3}
            className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
            placeholder="Например, удобное время для звонка"
          />
          <p className="mt-4 flex justify-between border-t border-slate-100 pt-3 font-semibold dark:border-slate-800">
            <span>Стоимость товаров</span>
            <span className="tabular-nums">{formatShopRub(subtotal)}</span>
          </p>
          {!canOrder ? (
            <PublicAuthTrigger
              intent="register"
              nextPath="/shop"
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Войти, чтобы отправить заказ
            </PublicAuthTrigger>
          ) : (
            <button
              type="button"
              disabled={
                busy ||
                lines.length === 0 ||
                hasUnresolvedCartItems ||
                hasUnavailableItem ||
                (deliveryMethod === "COURIER" && (!deliveryCity.trim() || !deliveryAddress.trim()))
              }
              onClick={onSubmit}
              className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ShoppingBag size={17} aria-hidden="true" />
              {busy ? "Отправляем…" : "Отправить заказ"}
            </button>
          )}
          <p className="mt-3 text-xs leading-5 text-slate-500">
            {deliveryMethod === "COURIER"
              ? "Стоимость доставки предложит администратор отдельно. Для изделий, изготовляемых на заказ, доставку согласуем после готовности. Онлайн-оплаты нет."
              : "Администратор сначала проверит наличие; оплату и получение согласуем отдельно. Онлайн-оплаты нет."}
          </p>
        </>
      )}
    </SectionCard>
  </section>
);
