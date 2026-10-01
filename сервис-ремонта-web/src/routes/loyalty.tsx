import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Info, Star } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getLoyalty } from "@/lib/api";

const LoyaltyPage = () => {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["loyalty", token],
    queryFn: ({ signal }) => getLoyalty(token!, signal),
    enabled: Boolean(token),
  });
  return (
    <AppShell active="/loyalty">
      <PageTitle
        eyebrow="БОНУСЫ"
        title="Программа лояльности"
        description="Начисляем 5% от завершённого ремонта. Один балл равен одному рублю; при завершении следующего заказа можно списать до 30% его суммы."
      />
      <SectionCard className="max-w-3xl">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950">
            <Star fill="currentColor" />
          </span>
          <div>
            <p className="text-sm text-slate-500">Доступный баланс</p>
            <h2 className="mt-1 text-3xl font-semibold">
              {(query.data?.balance ?? 0).toLocaleString("ru-RU")} баллов
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Бонусы вычитаются из учётной суммы при завершении ремонта. Онлайн-оплата не
              подключена.
            </p>
          </div>
        </div>
      </SectionCard>
      <h2 className="mt-7 mb-3 font-semibold">История операций</h2>
      <div className="grid gap-2">
        {(query.data?.transactions ?? []).map((entry) => (
          <SectionCard key={entry.id} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {entry.points >= 0 ? (
                <ArrowDownLeft className="text-emerald-600" />
              ) : (
                <ArrowUpRight className="text-amber-600" />
              )}
              <div>
                <p className="text-sm font-medium">{entry.reason}</p>
                <p className="mt-1 text-xs text-slate-400">
                  {new Date(entry.createdAt).toLocaleString("ru-RU")}
                  {entry.order?.serviceNumber ? ` · ${entry.order.serviceNumber}` : ""}
                </p>
              </div>
            </div>
            <span
              className={`shrink-0 text-sm font-semibold ${entry.points < 0 ? "text-amber-700 dark:text-amber-300" : "text-emerald-700 dark:text-emerald-300"}`}
            >
              {entry.points > 0 ? "+" : ""}
              {entry.points} ₽
            </span>
          </SectionCard>
        ))}
        {!query.isLoading && (query.data?.transactions.length ?? 0) === 0 && (
          <SectionCard>
            <p className="text-sm text-slate-500">
              Пока нет операций. Баллы появятся после завершения ремонта.
            </p>
          </SectionCard>
        )}
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-400">
        <Info size={15} className="mt-0.5 shrink-0" />
        Бонусы учитываются в приложении и не заменяют кассовый чек или подтверждение фактической
        оплаты.
      </p>
    </AppShell>
  );
};
export const Route = createFileRoute("/loyalty")({ component: LoyaltyPage });
