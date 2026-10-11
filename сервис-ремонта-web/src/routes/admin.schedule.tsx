import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { RepairOrderPriority } from "@/features/admin/repair-order-priority";
import { useAuth } from "@/features/auth/auth-context";

import { getRepairSchedule } from "@/lib/api";

const statusNames: Record<string, string> = {
  REQUESTED: "Новая",
  ASSIGNED: "Назначен мастер",
  IN_PROGRESS: "В ремонте",
  READY_FOR_PICKUP: "Готова к выдаче",
};

const SchedulePage = () => {
  const { token } = useAuth();
  const [weekOffset, setWeekOffset] = useState(0);
  const from = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - ((date.getDay() + 6) % 7) + weekOffset * 7);
    return date;
  }, [weekOffset]);
  const to = useMemo(() => {
    const date = new Date(from);
    date.setDate(date.getDate() + 7);
    return date;
  }, [from]);
  const fromIso = from.toISOString();
  const toIso = to.toISOString();
  const schedule = useQuery({
    queryKey: ["repair-schedule", token, fromIso],
    queryFn: ({ signal }) => getRepairSchedule(token!, fromIso, toIso, signal),
    enabled: Boolean(token),
  });
  const orders = schedule.data?.orders ?? [];
  const grouped = new Map<string, typeof orders>();
  const workload = new Map<string, number>();
  for (const order of orders) {
    const preferredAt = order.preferredAt ? new Date(order.preferredAt) : null;
    if (!preferredAt) continue;
    const key = `${preferredAt.getFullYear()}-${preferredAt.getMonth()}-${preferredAt.getDate()}`;
    grouped.set(key, [...(grouped.get(key) ?? []), order]);
    const technicianName = order.assignedTechnician?.displayName ?? "Без мастера";
    workload.set(technicianName, (workload.get(technicianName) ?? 0) + 1);
  }
  const days = [...grouped.entries()].sort((left, right) => left[0].localeCompare(right[0]));

  return (
    <AppShell active="/admin/schedule">
      <PageTitle
        eyebrow="АДМИНИСТРИРОВАНИЕ"
        title="Расписание мастеров"
        description="Заявки сгруппированы по времени, которое запросил клиент. Назначение мастера и перенос доступны в карточке заявки."
      />
      <SectionCard className="mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-slate-500">Неделя</p>
            <p className="mt-1 font-semibold">
              {from.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} —{" "}
              {new Date(to.getTime() - 1).toLocaleDateString("ru-RU", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((value) => value - 1)}
              aria-label="Предыдущая неделя"
              className="grid size-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="min-h-10 rounded-xl border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((value) => value + 1)}
              aria-label="Следующая неделя"
              className="grid size-10 place-items-center rounded-xl border border-slate-200 dark:border-slate-700"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </SectionCard>
      {workload.size > 0 && (
        <section
          aria-label="Загрузка мастеров"
          className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
        >
          {[...workload.entries()].map(([name, count]) => (
            <SectionCard key={name} className="!p-4">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="mt-1 text-xs text-slate-500">{count} заявок на этой неделе</p>
            </SectionCard>
          ))}
        </section>
      )}
      {schedule.isLoading && <p className="text-sm text-slate-500">Загружаем расписание…</p>}
      {schedule.isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить расписание.
        </p>
      )}
      {!schedule.isLoading && !schedule.isError && orders.length === 0 && (
        <SectionCard>
          <p className="text-sm text-slate-500">На эту неделю заявок с выбранным временем нет.</p>
        </SectionCard>
      )}
      <div className="grid gap-4">
        {days.map(([key, dayOrders]) => {
          const date = dayOrders[0]?.preferredAt ? new Date(dayOrders[0].preferredAt) : new Date();
          return (
            <SectionCard key={key}>
              <h2 className="mb-3 text-sm font-semibold capitalize">
                {date.toLocaleDateString("ru-RU", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </h2>
              <div className="grid gap-3">
                {dayOrders
                  .slice()
                  .sort((left, right) =>
                    (left.preferredAt ?? "").localeCompare(right.preferredAt ?? ""),
                  )
                  .map((order) => (
                    <article
                      key={order.id}
                      className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-blue-600">
                            {order.preferredAt
                              ? new Date(order.preferredAt).toLocaleTimeString("ru-RU", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "Время не указано"}{" "}
                            {" · "}
                            {order.serviceNumber}
                          </p>
                          <h3 className="mt-1 font-semibold">
                            {[order.deviceBrand, order.deviceModel, order.deviceType]
                              .filter(Boolean)
                              .join(" · ")}
                          </h3>
                          <p className="mt-1 text-sm text-slate-500">{order.problem}</p>
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium dark:bg-slate-800">
                          {statusNames[order.status] ?? order.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500 dark:border-slate-800">
                        <span>
                          {order.customer.displayName} ·{" "}
                          {order.assignedTechnician?.displayName ?? "Мастер не назначен"}
                        </span>
                        <span>
                          {[order.city, order.street, order.house].filter(Boolean).join(", ")}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <RepairOrderPriority
                          orderId={order.id}
                          priority={order.priority}
                          token={token!}
                          canEdit
                        />
                        <Link
                          to="/admin/orders/$orderId"
                          params={{ orderId: order.id }}
                          className="min-h-9 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold dark:border-slate-700"
                        >
                          Открыть заявку
                        </Link>
                      </div>
                    </article>
                  ))}
              </div>
            </SectionCard>
          );
        })}
      </div>
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/schedule")({ component: SchedulePage });
