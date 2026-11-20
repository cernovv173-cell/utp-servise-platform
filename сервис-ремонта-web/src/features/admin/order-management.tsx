import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { SectionCard } from "@/components/app-shell";
import { Select } from "@/components/select";

import { AdminOrderCreate } from "@/features/admin/admin-order-create";
import { RepairOrderEditor } from "@/features/admin/repair-order-editor";
import { useAuth } from "@/features/auth/auth-context";
import {
  archiveForOrderListView,
  filterOrdersForListView,
} from "@/features/orders/order-list-view";
import type { OrderListView } from "@/features/orders/order-list-view";
import { OrderPaperwork } from "@/features/orders/order-paperwork";
import { RepairEstimatePanel } from "@/features/orders/repair-estimate-panel";
import { RepairOrderChat } from "@/features/orders/repair-order-chat";
import { RepairOrderDisclosureSummary } from "@/features/orders/repair-order-disclosure-summary";
import { RepairOrderInformation } from "@/features/orders/repair-order-information";
import { RepairOrderListTabs } from "@/features/orders/repair-order-list-tabs";
import { RepairWorkActPanel } from "@/features/orders/repair-work-act-panel";
import { ServiceNumberBarcode } from "@/features/orders/service-number-barcode-view";

import {
  assignOrder,
  getAdminRepairOrder,
  getOrders,
  getRepairCatalog,
  getStaff,
  searchOrders,
  updateOrderStatus,
} from "@/lib/api";

const statusLabels: Record<string, string> = {
  REQUESTED: "Новая",
  ASSIGNED: "Назначена",
  IN_PROGRESS: "В ремонте",
  READY_FOR_PICKUP: "Готова к выдаче",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};
const availableStatuses: Record<string, string[]> = {
  REQUESTED: ["REQUESTED", "CANCELLED"],
  ASSIGNED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_PROGRESS", "READY_FOR_PICKUP", "CANCELLED"],
  READY_FOR_PICKUP: ["READY_FOR_PICKUP", "CANCELLED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};
export const OrderManagement = ({
  orderId,
  editingWorkspace = false,
}: {
  orderId?: string;
  editingWorkspace?: boolean;
} = {}) => {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const [listView, setListView] = useState<OrderListView>("active");
  const archiveView = archiveForOrderListView(listView);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const isAdmin = user?.role === "ADMIN";
  const staff = useQuery({
    queryKey: ["staff", token],
    queryFn: ({ signal }) => getStaff(token!, signal),
  });
  const catalog = useQuery({
    queryKey: ["repair-catalog", token],
    queryFn: ({ signal }) => getRepairCatalog(token!, signal),
    enabled: Boolean(token) && isAdmin,
  });
  const selectedOrder = useQuery({
    queryKey: ["admin-repair-order", token, orderId],
    queryFn: ({ signal }) => getAdminRepairOrder(token!, orderId!, signal),
    enabled: Boolean(token && isAdmin && orderId),
  });
  const orders = useQuery({
    queryKey: ["orders", token, archiveView],
    queryFn: ({ signal }) => getOrders(token!, signal, archiveView),
    enabled: Boolean(token && !orderId),
  });
  const found = useQuery({
    queryKey: ["admin-order-search", token, search],
    queryFn: () => searchOrders(token!, search.trim()),
    enabled: !orderId && search.trim().length >= 2,
  });
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ["orders", token] }),
      client.invalidateQueries({ queryKey: ["admin-order-search", token] }),
      client.invalidateQueries({ queryKey: ["admin-repair-order", token] }),
    ]);
  };
  const mutate = useMutation({
    mutationFn: async (
      action:
        | { kind: "status"; id: string; value: string }
        | { kind: "assign"; id: string; value: string },
    ) => {
      if (action.kind === "status") return updateOrderStatus(token!, action.id, action.value);
      return assignOrder(token!, action.id, action.value);
    },
    onSuccess: refresh,
  });
  const list = orderId
    ? selectedOrder.data?.order
      ? [selectedOrder.data.order]
      : []
    : search.trim().length >= 2
      ? filterOrdersForListView(found.data?.orders ?? [], listView)
      : filterOrdersForListView(orders.data?.orders ?? [], listView);
  const activeTechnicians = (staff.data?.staff ?? []).filter(
    (member) => member.role === "TECHNICIAN" && member.active,
  );
  return (
    <SectionCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">
          {orderId
            ? selectedOrder.data?.order
              ? `Заявка ${selectedOrder.data.order.serviceNumber}`
              : "Карточка заявки"
            : editingWorkspace
              ? "Выберите заявку для редактирования"
              : "Заявки на ремонт"}
        </h2>
        {orderId ? (
          <Link
            to="/admin/orders"
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
          >
            ← К списку заявок
          </Link>
        ) : (
          <div className="flex flex-wrap gap-2">
            <AdminOrderCreate onCreated={refresh} />
          </div>
        )}
      </div>
      {!orderId && (
        <>
          <div className="mt-4">
            <RepairOrderListTabs value={listView} onChange={setListView} />
          </div>
          <div className="mt-4">
            <label className="grid gap-1 text-sm font-medium">
              Поиск по сервисному номеру
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Например, UTP-2026-000001"
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>
        </>
      )}
      {orderId && selectedOrder.isLoading && (
        <p className="mt-4 text-sm text-slate-500">Загружаем заявку…</p>
      )}
      {orderId && selectedOrder.isError && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          Не удалось загрузить заявку. Проверьте доступ и обновите страницу.
        </p>
      )}
      <div className="mt-4 grid gap-3">
        {list.map((order) => (
          <article
            key={order.id}
            className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800"
          >
            <details open={Boolean(orderId)}>
              <RepairOrderDisclosureSummary
                order={order}
                statusLabel={statusLabels[order.status] ?? order.status}
                customerName={order.customer?.displayName ?? "Клиент"}
              />
              <div className="border-t border-slate-100 p-4 dark:border-slate-800">
                {!orderId && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {order.status === "REQUESTED" && (
                      <button
                        type="button"
                        aria-expanded={editingOrderId === order.id}
                        onClick={() =>
                          setEditingOrderId((current) => (current === order.id ? null : order.id))
                        }
                        className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        {editingOrderId === order.id
                          ? "Закрыть редактирование"
                          : "Редактировать приём"}
                      </button>
                    )}
                    <Link
                      to="/admin/orders/$orderId"
                      params={{ orderId: order.id }}
                      className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-xs font-semibold text-blue-700 hover:bg-slate-50 dark:border-slate-700 dark:text-blue-300 dark:hover:bg-slate-800"
                    >
                      Открыть заявку и чат
                    </Link>
                  </div>
                )}
                <ServiceNumberBarcode serviceNumber={order.serviceNumber} />
                {token && <RepairOrderInformation order={order} token={token} />}
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {order.status === "REQUESTED" && (
                    <label className="grid gap-1 text-xs font-medium">
                      Статус приёма
                      <Select
                        ariaLabel={`Статус заявки ${order.serviceNumber}`}
                        value={order.status}
                        onValueChange={(value) =>
                          mutate.mutate({ kind: "status", id: order.id, value })
                        }
                        options={(availableStatuses[order.status] ?? [order.status]).map(
                          (value) => ({
                            value,
                            label: statusLabels[value] ?? value,
                          }),
                        )}
                        className="h-9 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                  )}
                  {order.status === "REQUESTED" ||
                  (order.assignedTechnicianId === null &&
                    ["ASSIGNED", "IN_PROGRESS", "READY_FOR_PICKUP"].includes(order.status)) ? (
                    <label className="grid gap-1 text-xs font-medium">
                      {order.status === "REQUESTED"
                        ? "Назначить мастера при приёме"
                        : "Назначить замену снятому мастеру"}
                      <Select
                        ariaLabel={`Мастер для заявки ${order.serviceNumber}`}
                        value={order.assignedTechnicianId ?? undefined}
                        placeholder="Выберите мастера"
                        onValueChange={(technicianId) =>
                          mutate.mutate({ kind: "assign", id: order.id, value: technicianId })
                        }
                        disabled={mutate.isPending}
                        options={activeTechnicians.map((member) => ({
                          value: member.id,
                          label: member.displayName,
                        }))}
                        className="h-9 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                      />
                    </label>
                  ) : (
                    <p className="self-end pb-2 text-xs font-medium text-slate-600 dark:text-slate-300">
                      Назначенный мастер: {order.assignedTechnician?.displayName ?? "не указан"}
                    </p>
                  )}
                </div>
                {token && (
                  <div className="mt-3">
                    <OrderPaperwork
                      order={order}
                      token={token}
                      canEditIntake={order.status === "REQUESTED"}
                    />
                  </div>
                )}
                {token && (
                  <RepairOrderEditor
                    order={order}
                    token={token}
                    catalogItems={catalog.data?.catalogItems ?? []}
                    isCatalogLoading={catalog.isLoading}
                    isCatalogError={catalog.isError}
                    isEditing={
                      order.status === "REQUESTED" && !orderId && editingOrderId === order.id
                    }
                    onEditingChange={(isEditing) => setEditingOrderId(isEditing ? order.id : null)}
                    showEditToggle={Boolean(orderId && order.status === "REQUESTED")}
                    onRefresh={refresh}
                  />
                )}
                {token && orderId && (
                  <RepairEstimatePanel
                    order={order}
                    token={token}
                    catalogItems={catalog.data?.catalogItems ?? []}
                    onRefresh={refresh}
                  />
                )}
                {token && (orderId || order.status === "IN_PROGRESS" || order.workAct) && (
                  <RepairWorkActPanel
                    order={order}
                    token={token}
                    catalogItems={catalog.data?.catalogItems ?? []}
                    onRefresh={refresh}
                  />
                )}
                {token && order.status === "REQUESTED" && (orderId || isAdmin) && (
                  <RepairOrderChat
                    token={token}
                    orderId={order.id}
                    defaultOpen={Boolean(orderId)}
                  />
                )}
                {order.expectedCompletionAt && (
                  <p className="mt-3 text-xs text-slate-500">
                    Ориентировочное завершение:{" "}
                    {new Date(order.expectedCompletionAt).toLocaleString("ru-RU")}
                  </p>
                )}
                {order.bonusDiscountRub > 0 && (
                  <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                    Оплата бонусами: {order.bonusDiscountRub.toLocaleString("ru-RU")} ₽
                  </p>
                )}
              </div>
            </details>
          </article>
        ))}
        {!orderId && orders.isLoading && (
          <p className="text-sm text-slate-500">Загружаем заявки…</p>
        )}
        {search.trim().length >= 2 && found.isLoading && (
          <p className="text-sm text-slate-500">Ищем номер…</p>
        )}
        {orderId && !selectedOrder.isLoading && !selectedOrder.isError && list.length === 0 && (
          <p className="text-sm text-slate-500">Заявка не найдена.</p>
        )}
        {!orderId && !orders.isLoading && list.length === 0 && (
          <p className="text-sm text-slate-500">Заявки не найдены.</p>
        )}
        {mutate.isError && (
          <p role="alert" className="text-sm text-rose-600">
            Действие не выполнено. Обновите список и попробуйте ещё раз.
          </p>
        )}
      </div>
    </SectionCard>
  );
};
