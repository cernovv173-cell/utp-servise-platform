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
  isUpdating,
}: {
  order: ShopOrder;
  onStatusChange: (orderId: string, status: "CONFIRMED" | "COMPLETED" | "CANCELLED") => void;
  isUpdating: boolean;
}) => (
  <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="font-semibold">Заказ #{order.id.slice(0, 8)}</p>
        <p className="mt-1 text-xs text-slate-500">Поступил {formatDate(order.createdAt)}</p>
      </div>
      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyle[order.status]}`}>
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
    {order.customerNote && (
      <p className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-sm leading-5 text-slate-600 dark:border-slate-700 dark:text-slate-300">
        <span className="font-semibold">Комментарий: </span>
        {order.customerNote}
      </p>
    )}
    <p className="mt-4 border-t border-slate-100 pt-3 text-right font-semibold dark:border-slate-800">
      Итого: {formatRub(order.totalRub)}
    </p>

    {(order.status === "PENDING" || order.status === "CONFIRMED") && (
      <div className="mt-4 flex flex-wrap gap-2">
        {order.status === "PENDING" ? (
          <button
            type="button"
            disabled={isUpdating}
            onClick={() => onStatusChange(order.id, "CONFIRMED")}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            <Check size={16} aria-hidden="true" /> Подтвердить наличие
          </button>
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

  const orders = ordersQuery.data?.orders ?? [];
  const pendingCount = orders.filter((order) => order.status === "PENDING").length;
  const visibleOrders = showAllOrders
    ? orders
    : orders.filter((order) => order.status === "PENDING");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          Наличие проверьте до подтверждения: тогда резервируется складской остаток. Оплата и
          получение согласуются с клиентом вне сайта.
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
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};
