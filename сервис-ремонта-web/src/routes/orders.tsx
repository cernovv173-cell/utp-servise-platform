import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { createOrder, getOrders } from "@/lib/api";

const statusLabels: Record<string, string> = {
  REQUESTED: "Новая",
  ASSIGNED: "Назначен мастер",
  IN_PROGRESS: "В ремонте",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};
const deviceLabels: Record<string, string> = {
  COMPUTER: "Компьютер",
  LAPTOP: "Ноутбук",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

const OrdersPage = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const query = useQuery({
    queryKey: ["orders", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
    enabled: Boolean(token),
  });
  const mutation = useMutation({
    mutationFn: (input: { deviceType: string; problem: string; address: string }) =>
      createOrder(token!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders", token] });
      setFormOpen(false);
      toast.success("Заявка отправлена");
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    mutation.mutate({
      deviceType: String(data.get("deviceType")),
      problem: String(data.get("problem")),
      address: String(data.get("address")),
    });
  };

  return (
    <AppShell active="/orders">
      <PageTitle
        eyebrow="ЗАКАЗЫ"
        title="Мои заявки"
        description="Создавайте заявки и отслеживайте этапы ремонта."
        action={
          user?.role === "CUSTOMER" ? (
            <button
              onClick={() => setFormOpen((value) => !value)}
              className="min-h-11 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              {formOpen ? "Закрыть" : "+ Создать заявку"}
            </button>
          ) : undefined
        }
      />
      {formOpen && (
        <SectionCard className="mb-5">
          <h2 className="mb-4 font-semibold">Новая заявка</h2>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Тип устройства
              <select
                name="deviceType"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              >
                <option value="COMPUTER">Компьютер</option>
                <option value="LAPTOP">Ноутбук</option>
                <option value="PHONE">Телефон</option>
                <option value="TABLET">Планшет</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Опишите неисправность
              <textarea
                name="problem"
                minLength={5}
                maxLength={2000}
                required
                rows={3}
                className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Адрес для обслуживания
              <input
                name="address"
                minLength={8}
                maxLength={500}
                required
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <div className="md:col-span-2">
              <button
                disabled={mutation.isPending}
                className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {mutation.isPending ? "Отправляем…" : "Отправить заявку"}
              </button>
              {mutation.isError && (
                <p className="mt-2 text-sm text-rose-600">
                  Не удалось отправить. Проверьте данные и повторите.
                </p>
              )}
            </div>
          </form>
        </SectionCard>
      )}
      {query.isLoading && <p className="text-sm text-slate-500">Загружаем заявки…</p>}
      {query.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось получить список заявок.
        </p>
      )}
      <div className="grid gap-4">
        {(query.data?.orders ?? []).map((order) => (
          <SectionCard key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Сервисный номер · {order.id}</p>
                <h2 className="mt-1 font-semibold">
                  {deviceLabels[order.deviceType] ?? order.deviceType}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{order.problem}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
              <span>Создана: {new Date(order.createdAt).toLocaleDateString("ru-RU")}</span>
              <Link to="/checks" className="font-semibold text-blue-600">
                Детали и чек →
              </Link>
            </div>
          </SectionCard>
        ))}
        {!query.isLoading && !query.isError && query.data?.orders.length === 0 && (
          <SectionCard>
            <p className="text-sm text-slate-500">
              Заявок пока нет. Создайте первую заявку, чтобы начать.
            </p>
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
};

export const Route = createFileRoute("/orders")({ component: OrdersPage });
