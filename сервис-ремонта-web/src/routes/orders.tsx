import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignPlacement } from "@/features/campaigns/campaign-banner";

import { createOrder, getLoyalty, getOrders, requestBonusRedemption } from "@/lib/api";

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
  const [showArchive, setShowArchive] = useState(false);
  const query = useQuery({
    queryKey: ["orders", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
    enabled: Boolean(token),
  });
  const loyalty = useQuery({
    queryKey: ["loyalty", token],
    queryFn: ({ signal }) => getLoyalty(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
  });
  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof createOrder>[1]) => createOrder(token!, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["orders", token] });
      setFormOpen(false);
      toast.success("Заявка отправлена");
    },
  });
  const bonuses = useMutation({
    mutationFn: ({ orderId, redeem }: { orderId: string; redeem: boolean }) =>
      requestBonusRedemption(token!, orderId, redeem),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["orders", token] }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    mutation.mutate({
      deviceType: String(data.get("deviceType")),
      problem: String(data.get("problem")),
      contactPhone: String(data.get("contactPhone")),
      city: String(data.get("city")),
      street: String(data.get("street")),
      house: String(data.get("house")),
      apartment: String(data.get("apartment") || ""),
      entrance: String(data.get("entrance") || ""),
      hasBarrier: data.get("hasBarrier") === "on",
      floor: String(data.get("floor") || ""),
      additionalPhone: String(data.get("additionalPhone") || ""),
      additionalInfo: String(data.get("additionalInfo") || ""),
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
      <CampaignPlacement placement="SERVICE" className="mb-5" />
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
            <label className="grid gap-1.5 text-sm font-medium">
              Телефон для связи
              <input
                name="contactPhone"
                type="tel"
                minLength={7}
                maxLength={32}
                required
                defaultValue={user?.phoneNumber ?? ""}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Город
              <input
                name="city"
                required
                minLength={2}
                maxLength={120}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Улица
              <input
                name="street"
                required
                minLength={2}
                maxLength={180}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Дом
              <input
                name="house"
                required
                maxLength={30}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Квартира
              <input
                name="apartment"
                maxLength={30}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Подъезд
              <input
                name="entrance"
                maxLength={30}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Этаж
              <input
                name="floor"
                maxLength={20}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Дополнительный телефон
              <input
                name="additionalPhone"
                type="tel"
                maxLength={32}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="hasBarrier" className="size-4 accent-blue-600" />
              Есть шлагбаум
            </label>
            <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
              Дополнительная информация
              <textarea
                name="additionalInfo"
                maxLength={500}
                rows={2}
                className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-900"
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
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Заявки и архив">
        {([
          [false, "Активные"],
          [true, "Архив"],
        ] as const).map(([archived, label]) => {
          const count = (query.data?.orders ?? []).filter(
            (order) => Boolean(order.archivedAt) === archived,
          ).length;
          return (
            <button
              key={label}
              type="button"
              aria-pressed={showArchive === archived}
              onClick={() => setShowArchive(archived)}
              className={`min-h-10 rounded-xl border px-4 text-sm font-semibold transition ${showArchive === archived ? "border-[#526fff] bg-[#eaf0ff] text-[#334fc4] dark:border-[#5675ff]/70 dark:bg-[#17264b] dark:text-[#91eaff] dark:shadow-[0_0_22px_rgba(78,116,255,0.14)]" : "border-slate-200 text-slate-600 dark:border-[#293a65] dark:text-[#aab8d9]"}`}
            >
              {label} <span className="ml-1 text-xs opacity-70">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="grid gap-4">
        {(query.data?.orders ?? [])
          .filter((order) => Boolean(order.archivedAt) === showArchive)
          .map((order) => (
          <SectionCard key={order.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-400">Сервисный номер · {order.serviceNumber}</p>
                <h2 className="mt-1 font-semibold">
                  {deviceLabels[order.deviceType] ?? order.deviceType}
                </h2>
                <p className="mt-1 text-sm text-slate-500">{order.problem}</p>
              </div>
              <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                {statusLabels[order.status] ?? order.status}
              </span>
            </div>
            {order.archivedAt && (
              <p className="mt-3 inline-flex rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-medium text-violet-800 dark:border-[#7855c7]/50 dark:bg-[#211841] dark:text-[#d4b7ff]">
                В архиве с {new Date(order.archivedAt).toLocaleString("ru-RU")}
              </p>
            )}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
              <span>Создана: {new Date(order.createdAt).toLocaleDateString("ru-RU")}</span>
              {order.expectedCompletionAt && (
                <span>
                  Ориентир завершения:{" "}
                  {new Date(order.expectedCompletionAt).toLocaleDateString("ru-RU")}
                </span>
              )}
              <Link to="/checks" className="font-semibold text-blue-600">
                Детали и чек →
              </Link>
            </div>
            {user?.role === "CUSTOMER" &&
              order.status === "COMPLETED" &&
              order.receipt?.paymentStatus !== "PAID" && (
                <button
                  onClick={() =>
                    bonuses.mutate({ orderId: order.id, redeem: !order.redeemBonuses })
                  }
                  className={`mt-3 rounded-lg border px-3 py-2 text-xs font-medium ${order.redeemBonuses ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "border-slate-200 dark:border-slate-700"}`}
                >
                  {order.redeemBonuses
                    ? "✓ Использовать бонусы при оплате"
                    : "Использовать бонусы при оплате"}
                </button>
              )}
            {order.status === "COMPLETED" && order.receipt?.paymentStatus === "PENDING" && (
              <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
                <p className="font-medium">К оплате по чеку {order.receipt.receiptNumber}</p>
                <p className="mt-1 text-slate-500">
                  Баланс: {(loyalty.data?.balance ?? 0).toLocaleString("ru-RU")} бонусов · максимум
                  к списанию:{" "}
                  {Math.min(
                    loyalty.data?.balance ?? 0,
                    Math.floor(order.receipt.totalRub * 0.3),
                  ).toLocaleString("ru-RU")}{" "}
                  ₽
                </p>
                <p className="mt-1 font-semibold">
                  Итог к оплате:{" "}
                  {(order.receipt.totalRub - order.receipt.bonusDiscountRub).toLocaleString(
                    "ru-RU",
                  )}{" "}
                  ₽
                </p>
              </div>
            )}
          </SectionCard>
          ))}
        {!query.isLoading &&
          !query.isError &&
          !(query.data?.orders ?? []).some(
            (order) => Boolean(order.archivedAt) === showArchive,
          ) && (
          <SectionCard>
            <p className="text-sm text-slate-500">
              {showArchive
                ? "В архиве пока нет заявок. Перенос предыдущего дня выполняется автоматически после полуночи по времени Москвы."
                : "Активных заявок пока нет. Создайте новую заявку, чтобы начать."}
            </p>
          </SectionCard>
        )}
      </div>
    </AppShell>
  );
};

export const Route = createFileRoute("/orders")({ component: OrdersPage });
