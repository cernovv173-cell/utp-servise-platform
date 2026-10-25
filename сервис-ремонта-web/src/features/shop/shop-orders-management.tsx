import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Clock3, PackageCheck, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  type ShopOrder,
  type ShopOrderStatus,
  getAdminShopOrders,
  offerShopDelivery,
  updateShopOrderStatus,
} from "@/lib/api";

const rubles = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const formatRub = (amount: number) => `${rubles.format(amount)} ₽`;

const statusLabel: Record<ShopOrderStatus, string> = {
  PENDING: "Ожидает проверки",
  CONFIRMED: "Наличие подтверждено",
  COMPLETED: "Выдан",
  CANCELLED: "Отменён",
};

const deliveryAreaLabel = {
  MOSCOW: "Москва",
  MOSCOW_REGION: "Московская область",
} as const;

const statusStyle: Record<ShopOrderStatus, string> = {
  PENDING: "bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
  CONFIRMED: "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-cyan-200",
  COMPLETED: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  CANCELLED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(value),
  );

const ShopOrderCard = ({
  order,
  onStatusChange,
  onDeliveryOffer,
  isUpdating,
  isOffering,
}: {
  order: ShopOrder;
  onStatusChange: (orderId: string, status: "CONFIRMED" | "COMPLETED" | "CANCELLED") => void;
  onDeliveryOffer: (orderId: string, fee: number, window: string) => void;
  isUpdating: boolean;
  isOffering: boolean;
}) => {
  const [feeInput, setFeeInput] = useState(order.deliveryFeeRub?.toString() ?? "");
  const [windowInput, setWindowInput] = useState(order.deliveryWindow ?? "");
  const deliveryAccepted = Boolean(order.deliveryOfferAcceptedAt);
  const areaName = order.deliveryArea ? deliveryAreaLabel[order.deliveryArea] : "Регион не указан";

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">Заказ #{order.id.slice(0, 8)}</p>
          <p className="mt-1 text-xs text-slate-500">Поступил {formatDate(order.createdAt)}</p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[order.status]}`}
        >
          {statusLabel[order.status]}
        </span>
      </div>

      <div className="mt-4 grid gap-1 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
        <p className="font-medium">{order.customer?.displayName ?? "Клиент"}</p>
        {order.customer?.phoneNumber && (
          <a
            className="text-blue-700 hover:underline dark:text-cyan-300"
            href={`tel:${order.customer.phoneNumber}`}
          >
            {order.customer.phoneNumber}
          </a>
        )}
        {order.customer?.email && (
          <a
            className="text-blue-700 hover:underline dark:text-cyan-300"
            href={`mailto:${order.customer.email}`}
          >
            {order.customer.email}
          </a>
        )}
      </div>

      <ul className="mt-4 grid gap-2 text-sm">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between gap-3">
            <span className="min-w-0">
              {item.name} × {item.quantity}
            </span>
            <span className="shrink-0 tabular-nums">
              {formatRub(item.unitPriceRub * item.quantity)}
            </span>
          </li>
        ))}
      </ul>
      {order.deliveryMethod === "COURIER" && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3 text-sm dark:border-blue-900 dark:bg-blue-950/20">
          <p className="font-semibold">Курьерская доставка · {areaName}</p>
          <p className="mt-1">Населённый пункт: {order.deliveryCity ?? "не указан"}</p>
          <p className="mt-1">Адрес: {order.deliveryAddress}</p>
          {order.deliveryRequestNote && (
            <p className="mt-1">Пожелания: {order.deliveryRequestNote}</p>
          )}
          {order.deliveryFeeRub !== null && order.deliveryWindow && (
            <p className="mt-2">
              Предложение: {formatRub(order.deliveryFeeRub)} · {order.deliveryWindow}
            </p>
          )}
          {deliveryAccepted ? (
            <p className="mt-2 font-medium text-emerald-700 dark:text-emerald-300">
              Клиент согласился. Теперь можно подтвердить наличие и зарезервировать товар.
            </p>
          ) : order.deliveryFeeRub !== null ? (
            <p className="mt-2 text-amber-800 dark:text-amber-200">
              Ожидаем согласия клиента. Свяжитесь с ним по телефону, если нужно сообщить условия.
            </p>
          ) : (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              Уточните цену и срок у курьера, затем отправьте предложение клиенту.
            </p>
          )}
          {order.status === "PENDING" && (
            <form
              className="mt-3 grid gap-3 border-t border-blue-200 pt-3 sm:grid-cols-[0.7fr_1.3fr_auto] sm:items-end dark:border-blue-900"
              onSubmit={(event) => {
                event.preventDefault();
                const fee = Number(feeInput);
                if (!Number.isSafeInteger(fee) || fee < 0 || !windowInput.trim()) return;
                onDeliveryOffer(order.id, fee, windowInput.trim());
              }}
            >
              <label
                className="grid gap-1 text-xs font-semibold"
                htmlFor={`delivery-fee-${order.id}`}
              >
                Цена доставки, ₽
                <input
                  id={`delivery-fee-${order.id}`}
                  type="number"
                  min="0"
                  max="1000000"
                  step="1"
                  required
                  value={feeInput}
                  onChange={(event) => setFeeInput(event.target.value)}
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
              <label
                className="grid gap-1 text-xs font-semibold"
                htmlFor={`delivery-window-${order.id}`}
              >
                Предлагаемый срок или интервал
                <input
                  id={`delivery-window-${order.id}`}
                  type="text"
                  maxLength={160}
                  required
                  value={windowInput}
                  onChange={(event) => setWindowInput(event.target.value)}
                  placeholder="Например, завтра с 14:00 до 18:00"
                  className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
              <button
                type="submit"
                disabled={isOffering || !windowInput.trim() || feeInput === ""}
                className="min-h-10 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isOffering
                  ? "Сохраняем…"
                  : deliveryAccepted
                    ? "Изменить предложение"
                    : "Предложить клиенту"}
              </button>
            </form>
          )}
        </div>
      )}
      {order.customerNote && (
        <p className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm leading-5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <span className="font-semibold">Комментарий: </span>
          {order.customerNote}
        </p>
      )}
      <p className="mt-4 border-t border-slate-100 pt-3 text-right font-semibold dark:border-slate-800">
        Товары: {formatRub(order.totalRub)}
        {order.deliveryFeeRub !== null && (
          <span className="ml-3">Всего: {formatRub(order.totalRub + order.deliveryFeeRub)}</span>
        )}
      </p>

      {(order.status === "PENDING" || order.status === "CONFIRMED") && (
        <div className="mt-4 flex flex-wrap gap-2">
          {order.status === "PENDING" &&
          (order.deliveryMethod !== "COURIER" || deliveryAccepted) ? (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onStatusChange(order.id, "CONFIRMED")}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              <Check size={16} aria-hidden="true" /> Подтвердить наличие
            </button>
          ) : order.status === "PENDING" ? (
            <p className="self-center text-sm text-amber-800 dark:text-amber-200">
              Подтверждение и резерв товара доступны после согласия клиента.
            </p>
          ) : (
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => onStatusChange(order.id, "COMPLETED")}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              <PackageCheck size={16} aria-hidden="true" /> Отметить выданным
            </button>
          )}
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onStatusChange(order.id, "CANCELLED")}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            <X size={16} aria-hidden="true" /> Отменить
          </button>
        </div>
      )}
    </article>
  );
};

export const ShopOrdersManagement = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [showAllOrders, setShowAllOrders] = useState(false);
  const ordersQuery = useQuery({
    queryKey: ["admin-shop-orders", token],
    queryFn: ({ signal }) => getAdminShopOrders(token!, signal),
    enabled: Boolean(token),
  });
  const updateMutation = useMutation({
    mutationFn: ({
      orderId,
      status,
    }: {
      orderId: string;
      status: "CONFIRMED" | "COMPLETED" | "CANCELLED";
    }) => updateShopOrderStatus(token!, orderId, status),
    onSuccess: (_result, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["admin-shop-orders", token] });
      toast.success(
        variables.status === "CONFIRMED"
          ? "Наличие подтверждено, остаток обновлён."
          : variables.status === "COMPLETED"
            ? "Заказ отмечен как выданный."
            : "Заказ отменён, остаток возвращён при необходимости.",
      );
    },
    onError: () =>
      toast.error("Не удалось изменить заказ. Проверьте остаток товара и попробуйте снова."),
  });
  const deliveryOfferMutation = useMutation({
    mutationFn: ({ orderId, fee, window }: { orderId: string; fee: number; window: string }) =>
      offerShopDelivery(token!, orderId, fee, window),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-shop-orders", token] });
      toast.success("Предложение сохранено. Клиент увидит цену и срок и сможет ответить.");
    },
    onError: () => toast.error("Не удалось сохранить предложение доставки. Проверьте поля."),
  });

  const orders = ordersQuery.data?.orders ?? [];
  const pendingCount = orders.filter((order) => order.status === "PENDING").length;
  const visibleOrders = showAllOrders
    ? orders
    : orders.filter((order) => order.status === "PENDING");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Для курьерских заказов сначала сообщите клиенту цену и срок. Склад резервируется только
          после согласия клиента и подтверждения наличия.
        </p>
        <button
          type="button"
          onClick={() => void ordersQuery.refetch()}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-blue-700 hover:bg-blue-50 dark:text-cyan-300 dark:hover:bg-blue-950/40"
        >
          <Clock3 size={15} aria-hidden="true" /> Обновить
        </button>
      </div>
      {!ordersQuery.isLoading && !ordersQuery.isError && orders.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            aria-pressed={!showAllOrders}
            onClick={() => setShowAllOrders(false)}
            className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${showAllOrders ? "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300" : "bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"}`}
          >
            На подтверждение · {pendingCount}
          </button>
          <button
            type="button"
            aria-pressed={showAllOrders}
            onClick={() => setShowAllOrders(true)}
            className={`min-h-9 rounded-lg px-3 text-sm font-semibold ${showAllOrders ? "bg-blue-100 text-blue-900 dark:bg-blue-950/60 dark:text-cyan-200" : "border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"}`}
          >
            Все заказы · {orders.length}
          </button>
        </div>
      )}
      {ordersQuery.isLoading && (
        <SectionCard>
          <p className="text-sm text-slate-500">Загружаем заказы магазина…</p>
        </SectionCard>
      )}
      {ordersQuery.isError && (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить заказы магазина.
          </p>
        </SectionCard>
      )}
      {!ordersQuery.isLoading && !ordersQuery.isError && orders.length === 0 && (
        <SectionCard className="py-8 text-center text-sm text-slate-500">
          Заказов из магазина пока нет.
        </SectionCard>
      )}
      {!ordersQuery.isLoading &&
        !ordersQuery.isError &&
        orders.length > 0 &&
        visibleOrders.length === 0 && (
          <SectionCard className="py-8 text-center text-sm text-slate-500">
            Нет заказов, ожидающих подтверждения.
          </SectionCard>
        )}
      {visibleOrders.length > 0 && (
        <div className="grid gap-3 xl:grid-cols-2">
          {visibleOrders.map((order) => (
            <ShopOrderCard
              key={order.id}
              order={order}
              onStatusChange={(orderId, status) => updateMutation.mutate({ orderId, status })}
              onDeliveryOffer={(orderId, fee, window) =>
                deliveryOfferMutation.mutate({ orderId, fee, window })
              }
              isUpdating={updateMutation.isPending}
              isOffering={deliveryOfferMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};
