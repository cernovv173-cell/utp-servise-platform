import { Link } from "@tanstack/react-router";

import { SectionCard } from "@/components/app-shell";

import { OrderPaperwork } from "@/features/orders/order-paperwork";

import type { RepairOrder } from "@/lib/api";

const statusLabels: Record<string, string> = {
  REQUESTED: "Принята",
  ASSIGNED: "Назначен мастер",
  IN_PROGRESS: "В ремонте",
  READY_FOR_PICKUP: "Готова к выдаче",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};

export const BusinessOrderList = ({
  orders,
  token,
  isLoading,
  isError,
}: {
  orders: RepairOrder[];
  token: string;
  isLoading: boolean;
  isError: boolean;
}) => (
  <SectionCard>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold">История ремонтов и документы</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Акт приёма, заказ-наряд и гарантийный талон доступны из карточки каждой заявки.
        </p>
      </div>
      <Link
        to="/orders"
        search={{ scope: "business" }}
        className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
      >
        Все заявки
      </Link>
    </div>

    {isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем историю…</p>}
    {isError && (
      <p role="alert" className="mt-4 text-sm text-rose-600">
        Не удалось загрузить заявки компании.
      </p>
    )}
    {!isLoading && !isError && orders.length === 0 && (
      <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
        Корпоративных заявок пока нет. Создайте первую из карточки устройства компании.
      </p>
    )}

    <ul className="mt-4 grid gap-3">
      {orders.slice(0, 6).map((order) => (
        <li key={order.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-blue-700 dark:text-cyan-300">
                {statusLabels[order.status] ?? order.status} ·{" "}
                {new Date(order.createdAt).toLocaleDateString("ru-RU")}
              </p>
              <h3 className="mt-1 font-semibold">{order.serviceNumber}</h3>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                {[order.deviceBrand, order.deviceModel].filter(Boolean).join(" ") ||
                  order.deviceType}
              </p>
            </div>
            <OrderPaperwork order={order} token={token} canEditIntake={false} />
          </div>
          <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
            {order.problem}
          </p>
        </li>
      ))}
    </ul>
  </SectionCard>
);
