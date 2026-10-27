import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, Info, Star } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignPlacement } from "@/features/campaigns/campaign-banner";
import { ReferralCard } from "@/features/loyalty/referral-card";
import { BenefitsNavigation } from "@/features/navigation/benefits-navigation";

import { getLoyalty } from "@/lib/api";

const LoyaltyPage = () => {
  const { token, user } = useAuth();
  const query = useQuery({
    queryKey: ["loyalty", token],
    queryFn: ({ signal }) => getLoyalty(token!, signal),
    enabled: Boolean(token),
  });
  return (
    <AppShell active="/loyalty">
      {user?.role === "CUSTOMER" && <BenefitsNavigation />}
      <PageTitle
        eyebrow="БОНУСЫ"
        title="Программа лояльности"
        description="Это бонусные баллы, а не денежный баланс. Их нельзя вывести или перевести; ими можно получить скидку на услуги ремонта."
      />
      <CampaignPlacement placement="LOYALTY" className="mb-5" />
      <SectionCard className="max-w-3xl">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950">
            <Star fill="currentColor" />
          </span>
          <div>
            <p className="text-sm text-slate-500">Баланс бонусных баллов</p>
            <h2 className="mt-1 text-3xl font-semibold">
              {(query.data?.balance ?? 0).toLocaleString("ru-RU")} баллов
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              1 балл = 1 ₽ скидки на услуги ремонта. Баллы не являются наличными и не подлежат
              выводу или переводу.
            </p>
          </div>
        </div>
      </SectionCard>
      <SectionCard className="mt-4 max-w-3xl">
        <h2 className="font-semibold">Как начисляются и используются баллы</h2>
        <ul className="mt-3 grid gap-2 text-sm leading-6 text-slate-500">
          <li>За оплаченный ремонт начисляется 10% от суммы, оплаченной деньгами.</li>
          <li>За оплаченный заказ изделия начисляется 5% от денежной оплаты.</li>
          <li>В день рождения клиент получает 250 баллов — один раз за календарный год.</li>
          <li>Ранее начисленные игровые баллы сохранены на бонусном балансе клиентов.</li>
          <li>
            Списать можно до 30% стоимости строк «Услуга» в завершённом ремонте с неоплаченным
            чеком. Запчасти, товары и заказные изделия бонусами не оплачиваются.
          </li>
          <li>
            Профилактическая работа учитывается, если сервис включил её в заказ как услугу;
            действует тот же лимит. Списание оформляет администратор до оплаты чека.
          </li>
        </ul>
      </SectionCard>
      {query.isError && (
        <SectionCard className="max-w-3xl">
          <p className="text-sm text-rose-700 dark:text-rose-300">
            Не удалось обновить баланс и историю бонусов.
          </p>
          <button
            className="mt-3 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-white"
            onClick={() => void query.refetch()}
            type="button"
          >
            Повторить загрузку
          </button>
        </SectionCard>
      )}
      {token && user?.role === "CUSTOMER" && <ReferralCard token={token} />}
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
              {entry.points} баллов
            </span>
          </SectionCard>
        ))}
        {!query.isLoading && (query.data?.transactions.length ?? 0) === 0 && (
          <SectionCard>
            <p className="text-sm text-slate-500">
              Пока нет операций. Баллы появятся после подтверждения оплаты чека.
            </p>
          </SectionCard>
        )}
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-400">
        <Info size={15} className="mt-0.5 shrink-0" />
        Баллы нельзя обналичить, перевести другому клиенту или вывести на карту. Они учитываются
        только в программе лояльности и не заменяют чек или оплату деньгами.
      </p>
    </AppShell>
  );
};
export const Route = createFileRoute("/loyalty")({ component: LoyaltyPage });
