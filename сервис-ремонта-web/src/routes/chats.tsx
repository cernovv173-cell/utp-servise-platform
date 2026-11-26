import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";
import { MessageSectionNavigation } from "@/features/navigation/message-section-navigation";
import { OrderArchiveTabs } from "@/features/orders/order-archive-tabs";
import { RepairOrderChat } from "@/features/orders/repair-order-chat";

import { getOrders } from "@/lib/api";
import type { OrderArchiveView } from "@/lib/api";

const deviceLabels: Record<string, string> = {
  COMPUTER: "ПК",
  LAPTOP: "Ноутбук",
  MONOBLOCK: "Моноблок",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

const statusLabels: Record<string, string> = {
  REQUESTED: "Новая",
  ASSIGNED: "Назначен мастер",
  IN_PROGRESS: "В ремонте",
  READY_FOR_PICKUP: "Готова к выдаче",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};

const ChatsPage = () => {
  const { token, user } = useAuth();
  const { orderId } = Route.useSearch();
  const [archiveView, setArchiveView] = useState<OrderArchiveView>("active");
  const canViewChats =
    user?.role === "CUSTOMER" ||
    hasPermission(user, "repairs") ||
    hasPermission(user, "communications");
  const canOpenSupport = user?.role === "CUSTOMER" || hasPermission(user, "communications");
  const orders = useQuery({
    queryKey: ["orders", token, archiveView],
    queryFn: ({ signal }) => getOrders(token!, signal, archiveView),
    enabled: Boolean(token && canViewChats),
  });
  const visibleOrders = (orders.data?.orders ?? []).filter(
    (order) => !orderId || order.id === orderId,
  );

  return (
    <AppShell active="/chats">
      {canViewChats && <MessageSectionNavigation canOpenSupport={canOpenSupport} />}
      <PageTitle
        eyebrow="СООБЩЕНИЯ ПО ЗАЯВКАМ"
        title="Чаты"
        description={
          hasPermission(user, "communications")
            ? "Переписки с клиентами сгруппированы по заявкам. Откройте нужный чат, чтобы ответить."
            : hasPermission(user, "repairs")
              ? "Здесь собраны чаты назначенных вам заказов. При необходимости можно позвать администратора."
              : orderId
                ? "Это отдельная переписка по гарантийному обращению. Она связана только с выбранным ремонтом."
                : "Выберите свою заявку, чтобы написать администратору сервиса."
        }
      />
      {orderId && (
        <Link
          to="/chats"
          search={{}}
          className="mb-4 inline-flex text-sm font-semibold text-blue-700 hover:underline dark:text-blue-300"
        >
          ← Все чаты
        </Link>
      )}
      {!canViewChats ? (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Чаты доступны клиентам и сотрудникам с правом ремонта или поддержки.
          </p>
        </SectionCard>
      ) : (
        <SectionCard>
          <OrderArchiveTabs value={archiveView} onChange={setArchiveView} />
          {orders.isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем чаты…</p>}
          {orders.isError && (
            <p role="alert" className="mt-4 text-sm text-rose-600">
              Не удалось загрузить список заявок и чатов.
            </p>
          )}
          {!orders.isLoading && !orders.isError && visibleOrders.length === 0 && (
            <p className="mt-4 text-sm text-slate-500">
              {orderId
                ? "Отдельный чат пока недоступен: проверьте, что заявка ещё активна."
                : "В этом разделе пока нет заявок с чатами."}
            </p>
          )}
          <div className="mt-4 grid gap-4">
            {visibleOrders.map((order) => (
              <article
                key={order.id}
                className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-blue-600">{order.serviceNumber}</p>
                    <h2 className="mt-1 text-sm font-semibold">
                      {order.customer?.displayName ? `${order.customer.displayName} · ` : ""}
                      {deviceLabels[order.deviceType] ?? order.deviceType}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">{order.problem}</p>
                    {order.warrantyOriginOrder && (
                      <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                        Гарантийное обращение по ремонту {order.warrantyOriginOrder.serviceNumber}
                      </p>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium dark:bg-slate-800">
                    {statusLabels[order.status] ?? order.status}
                  </span>
                </div>
                {token && <RepairOrderChat token={token} orderId={order.id} />}
              </article>
            ))}
          </div>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/chats")({
  validateSearch: z.object({ orderId: z.string().optional() }),
  component: ChatsPage,
});
