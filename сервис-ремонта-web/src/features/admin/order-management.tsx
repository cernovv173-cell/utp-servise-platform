import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  assignOrder,
  createRepairReceipt,
  getOrders,
  getStaff,
  searchOrders,
  setExpectedCompletion,
  updateOrderStatus,
} from "@/lib/api";

const statusLabels: Record<string, string> = {
  REQUESTED: "Новая",
  ASSIGNED: "Назначена",
  IN_PROGRESS: "В ремонте",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};
const availableStatuses: Record<string, string[]> = {
  REQUESTED: ["REQUESTED", "CANCELLED"],
  ASSIGNED: ["ASSIGNED", "IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: ["COMPLETED"],
  CANCELLED: ["CANCELLED"],
};
const localDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

export const OrderManagement = () => {
  const { token } = useAuth();
  const client = useQueryClient();
  const [search, setSearch] = useState("");
  const staff = useQuery({
    queryKey: ["staff", token],
    queryFn: ({ signal }) => getStaff(token!, signal),
  });
  const orders = useQuery({
    queryKey: ["orders", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
  });
  const found = useQuery({
    queryKey: ["admin-order-search", token, search],
    queryFn: () => searchOrders(token!, search.trim()),
    enabled: search.trim().length >= 2,
  });
  const refresh = () => client.invalidateQueries({ queryKey: ["orders", token] });
  const mutate = useMutation({
    mutationFn: async (
      action:
        | { kind: "deadline"; id: string; value: string | null }
        | { kind: "status"; id: string; value: string }
        | { kind: "assign"; id: string; value: string }
        | { kind: "receipt"; id: string },
    ) => {
      if (action.kind === "deadline") return setExpectedCompletion(token!, action.id, action.value);
      if (action.kind === "status") return updateOrderStatus(token!, action.id, action.value);
      if (action.kind === "assign") return assignOrder(token!, action.id, action.value);
      return createRepairReceipt(token!, action.id);
    },
    onSuccess: refresh,
  });
  const list = search.trim().length >= 2 ? (found.data?.orders ?? []) : (orders.data?.orders ?? []);
  return (
    <SectionCard>
      <h2 className="font-semibold">Заявки на ремонт</h2>
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
      <div className="mt-4 grid gap-3">
        {list.map((order) => (
          <article
            key={order.id}
            className="rounded-xl border border-slate-100 p-4 dark:border-slate-800"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-blue-600">{order.serviceNumber}</p>
                <h3 className="mt-1 font-semibold">
                  {order.customer?.displayName ?? "Клиент"} · {order.deviceType}
                </h3>
                <p className="mt-1 max-w-2xl text-sm text-slate-500">{order.problem}</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium dark:bg-slate-800">
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="grid gap-1 text-xs font-medium">
                Срок ремонта
                <input
                  type="datetime-local"
                  defaultValue={localDateTime(order.expectedCompletionAt)}
                  onBlur={(event) => {
                    const value = event.currentTarget.value;
                    mutate.mutate({
                      kind: "deadline",
                      id: order.id,
                      value: value ? new Date(value).toISOString() : null,
                    });
                  }}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Статус
                <select
                  value={order.status}
                  onChange={(event) =>
                    mutate.mutate({ kind: "status", id: order.id, value: event.target.value })
                  }
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  {(availableStatuses[order.status] ?? [order.status]).map((value) => (
                    <option key={value} value={value}>
                      {statusLabels[value] ?? value}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1 text-xs font-medium">
                Назначить мастера
                <select
                  value={order.assignedTechnicianId ?? ""}
                  onChange={(event) => {
                    if (event.target.value)
                      mutate.mutate({ kind: "assign", id: order.id, value: event.target.value });
                  }}
                  disabled={["COMPLETED", "CANCELLED", "IN_PROGRESS"].includes(order.status)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-950"
                >
                  <option value="">Не назначен</option>
                  {(staff.data?.staff ?? [])
                    .filter((member) => member.role === "TECHNICIAN" && member.active)
                    .map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.displayName}
                      </option>
                    ))}
                </select>
              </label>
              <div className="grid content-end">
                <button
                  disabled={order.status !== "COMPLETED" || mutate.isPending}
                  onClick={() => mutate.mutate({ kind: "receipt", id: order.id })}
                  className="h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {order.receipt ? "Обновить документ" : "Создать документ"}
                </button>
              </div>
            </div>
            {order.expectedCompletionAt && (
              <p className="mt-3 text-xs text-slate-500">
                Ориентировочное завершение:{" "}
                {new Date(order.expectedCompletionAt).toLocaleString("ru-RU")}
              </p>
            )}
            {order.bonusDiscountRub > 0 && (
              <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                Списано бонусами: {order.bonusDiscountRub.toLocaleString("ru-RU")} ₽
              </p>
            )}
          </article>
        ))}
        {orders.isLoading && <p className="text-sm text-slate-500">Загружаем заявки…</p>}
        {search.trim().length >= 2 && found.isLoading && (
          <p className="text-sm text-slate-500">Ищем номер…</p>
        )}
        {!orders.isLoading && list.length === 0 && (
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
