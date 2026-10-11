import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, CalendarDays, CheckCheck, Clock3, Wallet } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getOperationsDashboard } from "@/lib/api";

const minutesLabel = (minutes: number | null) => {
  if (minutes === null) return "Нет данных";
  if (minutes < 60) return `${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days} дн. ${hours % 24} ч`;
  return `${hours} ч ${minutes % 60} мин`;
};

const AdminOverviewPage = () => {
  const { token, user } = useAuth();
  const metrics = useQuery({
    queryKey: ["operations-dashboard", token],
    queryFn: ({ signal }) => getOperationsDashboard(token!, signal),
    enabled: Boolean(token && user?.role === "ADMIN"),
  });
  const data = metrics.data;
  const cards = [
    { label: "Активные заявки", value: data?.activeOrders, icon: Clock3 },
    { label: "Просрочены", value: data?.overdueOrders, icon: AlertTriangle },
    { label: `Новые за 30 дней`, value: data?.newOrders, icon: CalendarDays },
    { label: `Завершены за 30 дней`, value: data?.completedOrders, icon: CheckCheck },
  ];

  return (
    <AppShell active="/admin/overview">
      <PageTitle
        eyebrow="АДМИНИСТРИРОВАНИЕ"
        title="Обзор сервиса"
        description="Заявки, сроки, завершённые ремонты и поступившая оплата за последние 30 дней."
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              to="/admin/schedule"
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
            >
              Расписание
            </Link>
            <Link
              to="/admin/procurement"
              className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white"
            >
              Закупки
            </Link>
          </div>
        }
      />
      {metrics.isLoading && <p className="text-sm text-slate-500">Загружаем показатели…</p>}
      {metrics.isError && (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить показатели сервиса.
          </p>
        </SectionCard>
      )}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map(({ label, value, icon: Icon }) => (
              <SectionCard key={label}>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-slate-500">{label}</p>
                  <Icon size={18} className="text-blue-500" aria-hidden="true" />
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums">
                  {value?.toLocaleString("ru-RU") ?? "—"}
                </p>
              </SectionCard>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <SectionCard>
              <h2 className="font-semibold">Время и оплата</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                  <Clock3 size={18} className="text-blue-500" aria-hidden="true" />
                  <p className="mt-2 text-xs text-slate-500">Среднее время ремонта</p>
                  <p className="mt-1 text-lg font-semibold">
                    {minutesLabel(data.averageRepairMinutes)}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-900">
                  <Wallet size={18} className="text-emerald-500" aria-hidden="true" />
                  <p className="mt-2 text-xs text-slate-500">Получено по оплаченным чекам</p>
                  <p className="mt-1 text-lg font-semibold">
                    {data.collectedRub.toLocaleString("ru-RU")} ₽
                  </p>
                </div>
              </div>
            </SectionCard>
            <SectionCard>
              <h2 className="font-semibold">Популярные работы за 30 дней</h2>
              {data.popularWorks.length > 0 ? (
                <ol className="mt-3 grid gap-2">
                  {data.popularWorks.map((work, index) => (
                    <li
                      key={work.name}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2 text-sm dark:border-slate-800"
                    >
                      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-blue-50 text-xs font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                        {index + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{work.name}</span>
                      <span className="text-xs text-slate-500">{work.completedQuantity} шт.</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-3 text-sm text-slate-500">За период нет завершённых работ.</p>
              )}
            </SectionCard>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Счётчики и выручка сформированы по заявкам и оплаченным чекам. Среднее время считается
            от создания заявки до её завершения.
          </p>
        </>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/overview")({ component: AdminOverviewPage });
