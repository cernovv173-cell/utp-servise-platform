import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { PackageCheck, ShoppingCart } from "lucide-react";
import { useState } from "react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";
import { getProcurementSuppliers, getStockReceipts } from "@/features/procurement/procurement-api";
import { ProcurementSuppliers } from "@/features/procurement/procurement-suppliers";
import { StockReceiptDialog } from "@/features/procurement/stock-receipt-dialog";
import { StockReceiptHistory } from "@/features/procurement/stock-receipt-history";

import { getProcurementList, getRepairCatalog } from "@/lib/api";

const ProcurementPage = () => {
  const { token, user } = useAuth();
  const canView = hasPermission(user, "inventory");
  const list = useQuery({
    queryKey: ["procurement-list", token],
    queryFn: ({ signal }) => getProcurementList(token!, signal),
    enabled: Boolean(token && canView),
  });
  const suppliers = useQuery({
    queryKey: ["procurement-suppliers", token],
    queryFn: ({ signal }) => getProcurementSuppliers(token!, signal),
    enabled: Boolean(token && canView),
  });
  const receipts = useQuery({
    queryKey: ["stock-receipts", token],
    queryFn: ({ signal }) => getStockReceipts(token!, signal),
    enabled: Boolean(token && canView),
  });
  const catalog = useQuery({
    queryKey: ["repair-catalog", token],
    queryFn: ({ signal }) => getRepairCatalog(token!, signal),
    enabled: Boolean(token && canView),
  });
  const [receiptItemId, setReceiptItemId] = useState<string | null>(null);
  const items = list.data?.items ?? [];
  const catalogItems = catalog.data?.catalogItems ?? [];

  if (!canView) {
    return (
      <AppShell active="/admin/procurement">
        <PageTitle eyebrow="СКЛАД" title="Доступ ограничен" />
        <SectionCard>
          <p className="text-sm text-slate-500">
            Этот раздел доступен сотрудникам с правом на каталог и склад.
          </p>
        </SectionCard>
      </AppShell>
    );
  }

  return (
    <AppShell active="/admin/procurement">
      <PageTitle
        eyebrow="СКЛАД"
        title="Склад и поставщики"
        description="Пополнение склада, реестр поставщиков и история поступлений запчастей и товаров."
        action={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-50"
              disabled={catalog.isLoading || suppliers.isLoading}
              onClick={() => setReceiptItemId("")}
              type="button"
            >
              Оформить поступление
            </button>
            <Link
              to="/catalog"
              className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
            >
              Каталог и остатки
            </Link>
          </div>
        }
      />
      <SectionCard className="mb-4 border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20">
        <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
          Количество к закупке рассчитано до установленного минимального остатка. Запчасти из
          согласованных смет уже списаны со склада, поэтому они не прибавляются повторно к
          рекомендации. Поступление фиксирует выбранного поставщика и увеличивает остаток.
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
            Активные товары и запчасти находятся на уровне минимального остатка или выше, а
            незакрытых согласованных смет с деталями нет.
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
                <p className="text-xs text-slate-500">
                  {item.type === "SPARE_PART" ? "Запчасть" : "Товар"}
                </p>
                <p className="text-xs text-slate-500">Рекомендуется заказать</p>
                <p className="mt-1 text-2xl font-semibold text-amber-700 dark:text-amber-300">
                  {item.recommendedPurchase}
                </p>
                <button
                  className="mt-2 min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700"
                  onClick={() => setReceiptItemId(item.id)}
                  type="button"
                >
                  Записать поступление
                </button>
              </div>
            </div>
          </SectionCard>
        ))}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        Если для позиции ещё не указан фактический остаток, сначала установите его в каталоге, затем
        оформляйте поступления от поставщика.
      </p>
      {suppliers.isError ? (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить поставщиков.
          </p>
        </SectionCard>
      ) : (
        !suppliers.isLoading && <ProcurementSuppliers suppliers={suppliers.data?.suppliers ?? []} />
      )}
      {receipts.isError ? (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить историю поступлений.
          </p>
        </SectionCard>
      ) : (
        !receipts.isLoading && <StockReceiptHistory receipts={receipts.data?.receipts ?? []} />
      )}
      {receiptItemId !== null && (
        <StockReceiptDialog
          key={receiptItemId || "any-item"}
          items={catalogItems}
          onOpenChange={(open) => !open && setReceiptItemId(null)}
          open
          preselectedItemId={receiptItemId || undefined}
          suppliers={suppliers.data?.suppliers ?? []}
        />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/procurement")({ component: ProcurementPage });
