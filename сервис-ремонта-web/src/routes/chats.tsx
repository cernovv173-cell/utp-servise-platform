import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { OrderArchiveTabs } from "@/features/orders/order-archive-tabs";
import { RepairOrderChat } from "@/features/orders/repair-order-chat";

import { getOrders } from "@/lib/api";
import type { OrderArchiveView } from "@/lib/api";

const deviceLabels: Record<string, string> = {
  COMPUTER: "Компьютер",
  LAPTOP: "Ноутбук",
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
  const [archiveView, setArchiveView] = useState<OrderArchiveView>("active");
  const canViewChats = user?.role === "ADMIN" || user?.role === "CUSTOMER";
  const orders = useQuery({
    queryKey: ["orders", token, archiveView],
    queryFn: ({ signal }) => getOrders(token!, signal, archiveView),
    enabled: Boolean(token && canViewChats),
  });

  return (
    <AppShell active="/chats">
      <PageTitle
        eyebrow="СООБЩЕНИЯ ПО ЗАЯВКАМ"
        title="Чаты"
        description={
          user?.role === "ADMIN"
            ? "Переписки с клиентами сгруппированы по заявкам. Откройте нужный чат, чтобы ответить."
            : "Выберите свою заявку, чтобы написать администратору сервиса."
        }
      />
      {!canViewChats ? (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Вкладка чатов доступна администраторам и клиентам.
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
          {!orders.isLoading && !orders.isError && (orders.data?.orders.length ?? 0) === 0 && (
            <p className="mt-4 text-sm text-slate-500">В этом разделе пока нет заявок с чатами.</p>
          )}
          <div className="mt-4 grid gap-4">
            {(orders.data?.orders ?? []).map((order) => (
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

export const Route = createFileRoute("/chats")({ component: ChatsPage });
