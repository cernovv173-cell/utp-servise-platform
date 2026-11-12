import { Link } from "@tanstack/react-router";
import { MapPin, PackageOpen, Plus, Sparkles } from "lucide-react";

import type { ShopCraftItem, ShopOrder, ShopOrderStatus, ShopProduct } from "@/lib/api";
import { getShopCraftImageUrl, getShopProductImageUrl } from "@/lib/api";

import { formatShopRub } from "./shop-format";

const formatOrderDate = (date: string) =>
  new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(date),
  );

const orderStatusLabel: Record<ShopOrderStatus, string> = {
  PENDING: "Ожидает проверки",
  CONFIRMED: "Наличие подтверждено",
  COMPLETED: "Выдан",
  CANCELLED: "Отменён",
};

const deliveryAreaLabel: Record<"MOSCOW" | "MOSCOW_REGION", string> = {
  MOSCOW: "Москва",
  MOSCOW_REGION: "Московская область",
};

const availabilityLabel = (availability: ShopProduct["availability"]) => {
  if (availability === "IN_STOCK") return "Есть в наличии";
  if (availability === "OUT_OF_STOCK") return "Нет в наличии";
  return "Наличие уточнит администратор";
};

export const ProductCard = ({
  product,
  quantity,
  canOrder,
  onAdd,
}: {
  product: ShopProduct;
  quantity: number;
  canOrder: boolean;
  onAdd: () => void;
}) => (
  <article className="flex min-h-52 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
    {product.imageObjectIds.length > 0 ? (
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {product.imageObjectIds.slice(0, 4).map((objectId, index) => (
          <img
            key={objectId}
            src={getShopProductImageUrl(product.id, objectId)}
            alt={`${product.name} — фото ${index + 1}`}
            loading="lazy"
            className="size-24 shrink-0 rounded-xl bg-slate-100 object-cover dark:bg-slate-800"
          />
        ))}
      </div>
    ) : (
      <span className="mb-4 grid size-12 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-cyan-200">
        <PackageOpen size={23} aria-hidden="true" />
      </span>
    )}
    <div className="min-w-0">
      <h2 className="font-semibold">{product.name}</h2>
      {product.description && (
        <p className="mt-2 line-clamp-4 text-sm leading-5 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
          {product.description}
        </p>
      )}
      <p
        className={`mt-2 text-xs font-medium ${product.availability === "OUT_OF_STOCK" ? "text-rose-600 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}
      >
        {availabilityLabel(product.availability)}
      </p>
    </div>
    <div className="mt-auto flex items-end justify-between gap-3 pt-6">
      <p className="text-xl font-bold tabular-nums">{formatShopRub(product.unitPriceRub)}</p>
      {canOrder && product.availability !== "OUT_OF_STOCK" ? (
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
        >
          <Plus size={16} aria-hidden="true" />
          {quantity ? `В корзине: ${quantity}` : "В корзину"}
        </button>
      ) : (
        <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">
          {product.availability === "OUT_OF_STOCK" ? "Недоступен" : "Заказ из аккаунта клиента"}
        </span>
      )}
    </div>
  </article>
);

export const CraftCard = ({
  item,
  quantity,
  canOrder,
  onAdd,
}: {
  item: ShopCraftItem;
  quantity: number;
  canOrder: boolean;
  onAdd: () => void;
}) => (
  <article className="flex min-h-72 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
    {item.imageObjectId ? (
      <img
        src={getShopCraftImageUrl(item.id, item.imageObjectId)}
        alt={item.title}
        loading="lazy"
        className="h-48 w-full bg-slate-100 object-cover dark:bg-slate-800"
      />
    ) : (
      <div className="grid h-48 place-items-center bg-gradient-to-br from-amber-50 to-rose-50 text-amber-700 dark:from-amber-950/30 dark:to-rose-950/30 dark:text-amber-200">
        <Sparkles size={32} aria-hidden="true" />
      </div>
    )}
    <div className="flex flex-1 flex-col p-5">
      <span className="mb-2 w-fit rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
        Ручная работа
      </span>
      <h2 className="font-semibold">{item.title}</h2>
      <p className="mt-2 line-clamp-3 text-sm leading-5 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
        {item.description || "Уникальное изделие ручной работы."}
      </p>
      <p className="mt-3 text-xs font-medium text-emerald-700 dark:text-emerald-300">
        {item.stockQuantity > 0
          ? `Готово сейчас · ${item.stockQuantity} шт.`
          : "Пока нет готовых экземпляров"}
      </p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <p className="text-xl font-bold tabular-nums">{formatShopRub(item.priceRub)}</p>
        {canOrder && item.stockQuantity > 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Plus size={16} aria-hidden="true" />
            {quantity ? `В корзине: ${quantity}` : "В корзину"}
          </button>
        )}
      </div>
      {item.customOrderAvailable && (
        <Link
          to="/crafts"
          className="mt-3 text-sm font-semibold text-blue-700 hover:underline dark:text-cyan-300"
        >
          Обсудить изготовление на заказ
        </Link>
      )}
      {!canOrder && (
        <span className="mt-3 text-xs text-slate-500">
          Войдите в аккаунт клиента, чтобы заказать
        </span>
      )}
    </div>
  </article>
);

export const CustomerOrderCard = ({
  order,
  onDeliveryResponse,
  onCancelPickup,
  isResponding,
}: {
  order: ShopOrder;
  onDeliveryResponse: (orderId: string, accept: boolean) => void;
  onCancelPickup: (orderId: string) => void;
  isResponding: boolean;
}) => {
  const deliveryStatus =
    order.status === "PENDING" && order.deliveryMethod === "COURIER"
      ? order.deliveryOfferAcceptedAt
        ? "Условия доставки приняты"
        : order.deliveryFeeRub !== null
          ? "Нужно согласовать доставку"
          : "Уточняем доставку"
      : orderStatusLabel[order.status];
  const areaName = order.deliveryArea ? deliveryAreaLabel[order.deliveryArea] : null;

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Заказ #{order.id.slice(0, 8)}</p>
          <p className="mt-1 text-xs text-slate-500">{formatOrderDate(order.createdAt)}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-cyan-200">
          {deliveryStatus}
        </span>
      </div>
      <ul className="mt-3 grid gap-1 text-sm text-slate-600 dark:text-slate-300">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span>
              {item.name} × {item.quantity}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatShopRub(item.quantity * item.unitPriceRub)}
            </span>
          </li>
        ))}
      </ul>
      {order.deliveryMethod === "COURIER" && (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
          <p className="flex items-start gap-2 font-medium">
            <MapPin size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              {areaName}, {order.deliveryCity}, {order.deliveryAddress}
            </span>
          </p>
          {order.deliveryRequestNote && (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Пожелание: {order.deliveryRequestNote}
            </p>
          )}
          {order.deliveryFeeRub !== null && order.deliveryWindow ? (
            <div className="mt-3 border-t border-slate-200 pt-3 dark:border-slate-700">
              <p>Доставка: {formatShopRub(order.deliveryFeeRub)}</p>
              <p className="mt-1">Предлагаемое время: {order.deliveryWindow}</p>
              {order.status === "PENDING" && !order.deliveryOfferAcceptedAt && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => onDeliveryResponse(order.id, true)}
                    className="min-h-10 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Согласен, продолжить
                  </button>
                  <button
                    type="button"
                    disabled={isResponding}
                    onClick={() => onDeliveryResponse(order.id, false)}
                    className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold hover:bg-white disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
                  >
                    Отказаться от заказа
                  </button>
                </div>
              )}
              {order.deliveryOfferAcceptedAt && order.status === "PENDING" && (
                <p className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Вы согласились. Администратор проверит наличие и подтвердит заказ.
                </p>
              )}
            </div>
          ) : (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Администратор уточнит цену и срок, затем предложит условия доставки. Заказ будет
              подтверждён только после вашего согласия.
            </p>
          )}
        </div>
      )}
      <p className="mt-3 border-t border-slate-100 pt-3 text-right font-semibold dark:border-slate-800">
        Товары: {formatShopRub(order.totalRub)}
        {order.deliveryFeeRub !== null && (
          <span className="ml-3">
            Всего: {formatShopRub(order.totalRub + order.deliveryFeeRub)}
          </span>
        )}
      </p>
      {order.status === "PENDING" && order.deliveryMethod === "PICKUP" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Можно отменить до подтверждения наличия.</p>
          <button
            type="button"
            disabled={isResponding}
            onClick={() => onCancelPickup(order.id)}
            className="min-h-10 rounded-xl border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Отменить самовывоз
          </button>
        </div>
      )}
    </article>
  );
};
