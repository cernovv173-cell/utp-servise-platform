import { useQuery } from "@tanstack/react-query";
import { Download, LogIn, UserPlus } from "lucide-react";
import { useState } from "react";

import { SectionCard } from "@/components/app-shell";
import { Select } from "@/components/select";

import { useAuth } from "@/features/auth/auth-context";

import {
  type AdminProductAnalytics,
  type ProductAnalyticsMetricCounts,
  getAdminProductAnalytics,
} from "@/lib/api";

type PeriodDays = 7 | 30 | 90;
type Metric = keyof ProductAnalyticsMetricCounts;

const periodOptions = [
  { value: "7", label: "Последние 7 дней" },
  { value: "30", label: "Последние 30 дней" },
  { value: "90", label: "Последние 90 дней" },
];

const metricCards: Array<{
  key: Metric;
  title: string;
  explanation: string;
  icon: typeof LogIn;
  iconClassName: string;
}> = [
  {
    key: "LOGIN",
    title: "Входы",
    explanation: "Успешные входы, включая вход после регистрации",
    icon: LogIn,
    iconClassName: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  },
  {
    key: "REGISTRATION",
    title: "Регистрации",
    explanation: "Созданные клиентские аккаунты",
    icon: UserPlus,
    iconClassName: "bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-200",
  },
  {
    key: "APP_DOWNLOAD",
    title: "Скачивания приложения",
    explanation: "Успешно выданные ссылки на APK-файл",
    icon: Download,
    iconClassName: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-200",
  },
];

const channelLabels: Record<keyof AdminProductAnalytics["channels"], string> = {
  WEB: "Сайт",
  ANDROID: "Android-приложение",
  MAX: "МАКС",
  OTHER: "Другой источник",
};

const formatDay = (value: string) => {
  const [year, month, day] = value.split("-");
  return `${day}.${month}.${year}`;
};

export const AnalyticsDashboard = () => {
  const { token } = useAuth();
  const [period, setPeriod] = useState<PeriodDays>(30);
  const query = useQuery({
    queryKey: ["admin-product-analytics", token, period],
    queryFn: ({ signal }) => getAdminProductAnalytics(token!, period, signal),
    enabled: Boolean(token),
  });

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Показатели</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Выберите период для сводки и разбивки по источнику.
          </p>
        </div>
        <Select
          ariaLabel="Период аналитики"
          className="min-w-52 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          onValueChange={(value) => setPeriod(Number(value) as PeriodDays)}
          options={periodOptions}
          value={String(period)}
        />
      </div>

      {query.isLoading ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Загружаем аналитику…</p>
        </SectionCard>
      ) : query.isError ? (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить аналитику. Попробуйте обновить страницу.
          </p>
        </SectionCard>
      ) : query.data ? (
        <AnalyticsReport report={query.data} />
      ) : null}
    </div>
  );
};

const AnalyticsReport = ({ report }: { report: AdminProductAnalytics }) => (
  <>
    <div className="grid gap-3 md:grid-cols-3">
      {metricCards.map(({ key, title, explanation, icon: Icon, iconClassName }) => (
        <SectionCard key={key} className="flex min-h-36 flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">{title}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums">
                {report.totals[key].toLocaleString("ru-RU")}
              </p>
            </div>
            <span className={`grid size-10 place-items-center rounded-xl ${iconClassName}`}>
              <Icon size={19} aria-hidden="true" />
            </span>
          </div>
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">{explanation}</p>
        </SectionCard>
      ))}
    </div>

    <SectionCard>
      <div className="mb-4">
        <h2 className="font-semibold">По источнику</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          События за {formatDay(report.range.from)} — {formatDay(report.range.to)}.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">
                Источник
              </th>
              {metricCards.map(({ key, title }) => (
                <th scope="col" key={key} className="px-3 py-2 text-right font-medium">
                  {title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {Object.entries(channelLabels).map(([channel, label]) => (
              <tr key={channel}>
                <th scope="row" className="py-3 pr-4 font-medium">
                  {label}
                </th>
                {metricCards.map(({ key }) => (
                  <td key={key} className="px-3 py-3 text-right tabular-nums">
                    {report.channels[channel as keyof typeof report.channels][key].toLocaleString(
                      "ru-RU",
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>

    <SectionCard>
      <div className="mb-4">
        <h2 className="font-semibold">По дням</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Только успешные входы, регистрации и выдача ссылки на приложение.
        </p>
      </div>
      {report.daily.every((day) => !day.LOGIN && !day.REGISTRATION && !day.APP_DOWNLOAD) ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
          Пока нет событий за выбранный период. Сбор начинается после включения аналитики; более
          ранние события задним числом не учитываются.
        </p>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="sticky top-0 bg-white text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th scope="col" className="py-2 pr-4 font-medium">
                  Дата
                </th>
                {metricCards.map(({ key, title }) => (
                  <th scope="col" key={key} className="px-3 py-2 text-right font-medium">
                    {title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...report.daily].reverse().map((day) => (
                <tr key={day.day}>
                  <th scope="row" className="py-2.5 pr-4 font-medium">
                    {formatDay(day.day)}
                  </th>
                  {metricCards.map(({ key }) => (
                    <td key={key} className="px-3 py-2.5 text-right tabular-nums">
                      {day[key].toLocaleString("ru-RU")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>

    <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
      Скачивание считается, когда сервер выдаёт ссылку на APK; это не подтверждает завершение
      загрузки или установку. Сохраняются только суточные числа по типу события и источнику — без
      данных пользователей.
    </p>
  </>
);
