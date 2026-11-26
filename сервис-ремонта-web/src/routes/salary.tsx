import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Wallet } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";

import { useAuth } from "@/features/auth/auth-context";
import { hasPermission, isFullAdministrator } from "@/features/auth/staff-access";

import { type SalaryPeriodName, getSalarySummary } from "@/lib/api";

const periodLabels: Record<SalaryPeriodName, string> = {
  day: "Сегодня",
  week: "Эта неделя",
  month: "Этот месяц",
};

const formatRubles = (amount: number) => `${amount.toLocaleString("ru-RU")} ₽`;

const formatRange = (startsAt: string, endsAt: string, timeZone: string) => {
  const formatter = new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    timeZone,
  });
  const finalDate = new Date(new Date(endsAt).getTime() - 1);
  const first = formatter.format(new Date(startsAt));
  const last = formatter.format(finalDate);
  return first === last ? first : `${first} — ${last}`;
};

const SalaryPage = () => {
  const { token, user } = useAuth();
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const query = useQuery({
    queryKey: ["salary", token, timeZone],
    queryFn: ({ signal }) => getSalarySummary(token!, timeZone, signal),
    enabled: Boolean(token && (hasPermission(user, "repairs") || isFullAdministrator(user))),
  });
  const isAdmin = isFullAdministrator(user);
  const canViewSalary = isAdmin || hasPermission(user, "repairs");

  return (
    <AppShell active="/salary">
      <PageTitle
        eyebrow="РАСЧЁТ ВОЗНАГРАЖДЕНИЯ"
        title={isAdmin ? "Зарплата мастеров" : canViewSalary ? "Моя зарплата" : "Доступ ограничен"}
        description={
          isAdmin
            ? "Начисления рассчитаны по индивидуальной ставке каждого мастера только от стоимости услуг. Запчасти и товары не учитываются."
            : `Ваша ставка: ${query.data?.ratePercent ?? 75}% от стоимости услуг в завершённых ремонтах. Запчасти и товары не учитываются.`
        }
      />
      {!canViewSalary && (
        <SectionCard>
          <p className="text-sm text-slate-500">
            Раздел доступен сотрудникам с правом «Заявки и ремонт» и полным администраторам.
          </p>
        </SectionCard>
      )}
      {query.isLoading && (
        <SectionCard>
          <p className="text-sm text-slate-500">Загружаем расчёт…</p>
        </SectionCard>
      )}
      {query.isError && (
        <SectionCard>
          <p className="text-sm text-red-600">
            Не удалось загрузить зарплату. Обновите страницу или попробуйте позже.
          </p>
        </SectionCard>
      )}
      {query.data && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {(["day", "week", "month"] as const).map((period) => (
              <SectionCard key={period}>
                <p className="text-sm font-medium text-slate-500">
                  {isAdmin
                    ? `Все мастера · ${periodLabels[period].toLowerCase()}`
                    : periodLabels[period]}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight">
                  {formatRubles(query.data!.totals[period])}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {formatRange(
                    query.data!.ranges[period].startsAt,
                    query.data!.ranges[period].endsAt,
                    query.data!.timeZone,
                  )}
                </p>
              </SectionCard>
            ))}
          </div>
          {isAdmin && (
            <SectionCard className="mt-5">
              <h2 className="mb-3 font-semibold">Начисления по мастерам</h2>
              <Table className="dark:text-slate-100">
                <TableHeader className="dark:bg-slate-800">
                  <TableRow className="dark:border-slate-700 dark:hover:bg-slate-800">
                    <TableHead className="dark:text-slate-300">Мастер</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Ставка</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Сегодня</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Неделя</TableHead>
                    <TableHead className="text-right dark:text-slate-300">Месяц</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {query.data.technicians.map((technician) => (
                    <TableRow
                      key={technician.id}
                      className="dark:border-slate-800 dark:hover:bg-slate-800"
                    >
                      <TableCell className="font-medium">{technician.displayName}</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {technician.salaryRatePercent}%
                      </TableCell>
                      {(["day", "week", "month"] as const).map((period) => (
                        <TableCell key={period} className="text-right tabular-nums">
                          {formatRubles(technician.amounts[period])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {query.data.technicians.length === 0 && (
                <p className="py-5 text-sm text-slate-500">Учётных записей мастеров пока нет.</p>
              )}
            </SectionCard>
          )}
          {!isAdmin && (
            <SectionCard className="mt-5 flex items-start gap-3">
              <Wallet className="mt-0.5 shrink-0 text-blue-600" size={19} />
              <p className="text-sm leading-6 text-slate-500">
                Начисление фиксируется по дате завершения ремонта. Это расчёт заработка, а не
                отметка о фактической выплате.
              </p>
            </SectionCard>
          )}
        </>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/salary")({ component: SalaryPage });
