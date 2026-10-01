import { useQuery } from "@tanstack/react-query";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { getAdminLoyalty } from "@/lib/api";

export const LoyaltyManagement = () => {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["admin-loyalty", token],
    queryFn: ({ signal }) => getAdminLoyalty(token!, signal),
  });
  return (
    <SectionCard>
      <h2 className="font-semibold">Бонусные балансы клиентов</h2>
      <p className="mt-1 text-sm text-slate-500">
        Показываем баланс и до 1 000 последних начислений/списаний на клиента.
      </p>
      <div className="mt-4 grid gap-3">
        {(query.data?.customers ?? []).map((entry) => (
          <details
            key={entry.customer.id}
            className="rounded-xl border border-slate-100 p-3 dark:border-slate-800"
          >
            <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
              <span>
                <strong className="text-sm">{entry.customer.displayName}</strong>
                <span className="ml-2 text-xs text-slate-400">{entry.customer.email}</span>
              </span>
              <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                {entry.balance.toLocaleString("ru-RU")} баллов
              </span>
            </summary>
            <div className="mt-3 grid gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
              {entry.transactions.map((transaction) => (
                <div key={transaction.id} className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className="text-slate-500">
                    {transaction.reason} · {new Date(transaction.createdAt).toLocaleString("ru-RU")}
                  </span>
                  <strong
                    className={
                      transaction.points < 0
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-emerald-700 dark:text-emerald-300"
                    }
                  >
                    {transaction.points > 0 ? "+" : ""}
                    {transaction.points}
                  </strong>
                </div>
              ))}
            </div>
          </details>
        ))}
        {query.isLoading && <p className="text-sm text-slate-500">Загружаем историю…</p>}
        {!query.isLoading && (query.data?.customers.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500">Начисления появятся после завершения заказов.</p>
        )}
      </div>
    </SectionCard>
  );
};
