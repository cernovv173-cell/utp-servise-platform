import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { createRepairReceipt, getOrders } from "@/lib/api";

const ChecksPage = () => {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const query = useQuery({
    queryKey: ["orders", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
    enabled: Boolean(token),
  });
  const issue = useMutation({
    mutationFn: (orderId: string) => createRepairReceipt(token!, orderId),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders", token] }),
  });
  return (
    <AppShell active="/checks">
      <PageTitle
        eyebrow="ДОКУМЕНТЫ"
        title="Чеки и сервисные номера"
        description="Сведения о заказах, выполненных работах и сервисных номерах."
      />
      <div className="grid gap-4">
        {(query.data?.orders ?? []).map((order) => {
          const total = order.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPriceRub,
            0,
          );
          return (
            <SectionCard key={order.id} className="print:break-inside-avoid">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">Сервисный номер</p>
                  <h2 className="mt-1 font-semibold">{order.serviceNumber}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {order.deviceType} · {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 print:hidden"
                >
                  <Printer size={16} />
                  Печать
                </button>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                {order.items.length ? (
                  order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 py-2 text-sm">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        {(item.unitPriceRub * item.quantity).toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-sm text-slate-500">
                    Работы и запчасти пока не добавлены.
                  </p>
                )}
                <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
                  <span>Сумма учтённых работ</span>
                  <span>{total.toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
              {order.receipt && (
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-xs text-slate-400">
                    Документ № {order.receipt.receiptNumber} ·{" "}
                    {new Date(order.receipt.issuedAt).toLocaleDateString("ru-RU")}
                  </p>
                  {order.receipt.itemsSnapshot.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="mt-2 flex justify-between gap-4 text-sm"
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>{item.totalRub.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  ))}
                  <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
                    <span>Итого до скидки</span>
                    <span>{order.receipt.totalRub.toLocaleString("ru-RU")} ₽</span>
                  </div>
                  {order.receipt.bonusDiscountRub > 0 && (
                    <div className="mt-2 flex justify-between text-sm text-emerald-700 dark:text-emerald-300">
                      <span>Списано бонусами</span>
                      <span>−{order.receipt.bonusDiscountRub.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  )}
                </div>
              )}
              {user?.role === "ADMIN" && order.status === "COMPLETED" && (
                <button
                  onClick={() => issue.mutate(order.id)}
                  className="mt-4 min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white"
                >
                  {order.receipt ? "Обновить документ" : "Создать документ по ремонту"}
                </button>
              )}
            </SectionCard>
          );
        })}
        {!query.isLoading && (query.data?.orders.length ?? 0) === 0 && (
          <SectionCard>
            <p className="text-sm text-slate-500">Документы появятся после создания заявки.</p>
          </SectionCard>
        )}
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-400">
        <FileText size={15} className="mt-0.5 shrink-0" />
        Распечатанная карточка содержит учётные сведения о заказе и не является кассовым чеком или
        подтверждением онлайн-оплаты.
      </p>
    </AppShell>
  );
};
export const Route = createFileRoute("/checks")({ component: ChecksPage });
