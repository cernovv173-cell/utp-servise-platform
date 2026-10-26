import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PackageCheck, ShoppingCart } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getProcurementList } from "@/lib/api";

const ProcurementPage = () => {
  const { token, user } = useAuth();
  const canView = user?.role === "ADMIN" || user?.role === "PROCUREMENT";
  const list = useQuery({
    queryKey: ["procurement-list", token],
    queryFn: ({ signal }) => getProcurementList(token!, signal),
    enabled: Boolean(token && canView),
  });
  const items = list.data?.items ?? [];

  if (!canView) {
    return (
      <AppShell active="/admin/procurement">
        <PageTitle eyebrow="ЗАКУПКИ" title="Доступ ограничен" />
        <SectionCard>
          <p className="text-sm text-slate-500">
            Этот раздел доступен администраторам и мастерам закупки.
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  return (
    <AppShell active="/admin/procurement">
      <PageTitle
        eyebrow={user?.role === "PROCUREMENT" ? "ЗАКУПКИ" : "АДМИНИСТРИРОВАНИЕ"}
        title="Закупка запчастей"
        description="Рекомендации по пополнению склада и детали, задействованные в текущих ремонтах с согласованными сметами."
        action={
          <Link
            to="/catalog"
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
          >
            Каталог и остатки
          </Link>
        }
      />
      <SectionCard className="mb-4 border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Количество к закупке рассчитано до установленного минимального остатка. Запчасти из
          согласованных смет уже списаны со склада, поэтому они показаны отдельно и повторно не
          прибавляются к заказу поставщику.
        </p>
      </SectionCard>
      {list.isLoading && <p className="text-sm text-slate-500">Загружаем список…</p>}
      {list.isError && (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить закупочную сводку.
          </p>
        </SectionCard>
      )}
      {!list.isLoading && !list.isError && items.length === 0 && (
        <SectionCard className="grid justify-items-center gap-2 py-10 text-center">
          <PackageCheck size={28} className="text-emerald-600" aria-hidden="true" />
          <h2 className="font-semibold">Пополнение не требуется</h2>
          <p className="max-w-md text-sm text-slate-500">
            Активные запчасти находятся на уровне минимального остатка или выше, а незакрытых
            согласованных смет с деталями нет.
          </p>
        </SectionCard>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <SectionCard key={item.id}>
            <div className="flex items-start gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                <ShoppingCart size={18} aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold">{item.name}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  Остаток: {item.stockQuantity} · минимум: {item.minimumStockQuantity}
                </p>
                {item.activeEstimateQuantity > 0 && (
                  <p className="mt-1 text-xs text-slate-500">
                    В текущих согласованных ремонтах: {item.activeEstimateQuantity} шт. (уже учтено
                    при списании)
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-slate-500">Рекомендуется заказать</p>
                <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300">
                  {item.recommendedPurchase}
                </p>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Список обновляется автоматически из каталога и активных заявок. Для фактического изменения
        остатка откройте каталог.
      </p>
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/procurement")({ component: ProcurementPage });
