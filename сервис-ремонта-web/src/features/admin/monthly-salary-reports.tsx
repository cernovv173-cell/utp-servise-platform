import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, FileSpreadsheet } from "lucide-react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";

import { useAuth } from "@/features/auth/auth-context";

import {
  type MonthlySalaryReport,
  downloadMonthlySalaryReport,
  getMonthlySalaryReports,
} from "@/lib/api";

const formatPeriod = (start: string, end: string): string => {
  const formatDate = (value: string) => {
    const [year, month, day] = value.split("-");
    return `${day}.${month}.${year}`;
  };
  return `${formatDate(start)} — ${formatDate(end)}`;
};

const formatRubles = (amount: number) => `${amount.toLocaleString("ru-RU")} ₽`;

const getDeliveryLabel = (report: MonthlySalaryReport): string => {
  const counts = report.deliveryCounts;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  if (total === 0) return "Сохранён в архиве; получатель в МАКС не подключён";
  if (counts.SENT === total) return "Отправлен в МАКС";
  if (counts.UNKNOWN > 0) return "Сохранён; доставка в МАКС не подтверждена";
  if (counts.FAILED > 0) return "Сохранён; отправка в МАКС не удалась";
  return "Сохранён; отправка в МАКС ожидает обработки";
};

export const MonthlySalaryReports = () => {
  const { token } = useAuth();
  const query = useQuery({
    queryKey: ["admin-monthly-salary-reports", token],
    queryFn: ({ signal }) => getMonthlySalaryReports(token!, signal),
    enabled: Boolean(token),
  });
  const downloadMutation = useMutation({
    mutationFn: ({ reportId }: { reportId: string; fileName: string }) =>
      downloadMonthlySalaryReport(token!, reportId),
    onSuccess: (file, { fileName }) => {
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Не удалось скачать отчёт.");
    },
  });

  return (
    <div className="grid gap-5">
      <SectionCard className="flex items-start gap-3">
        <FileSpreadsheet
          className="mt-0.5 shrink-0 text-emerald-600"
          size={20}
          aria-hidden="true"
        />
        <div>
          <h2 className="font-semibold">Ежемесячные начисления мастерам</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Отчёт в формате XLSX формируется 1-го числа после 10:00 по московскому времени. Он
            включает список работ и записанные начисления каждого мастера. Файл остаётся в архиве,
            даже если администратор не подключён к МАКС.
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
            Указано начисление по данным сервиса; налоги, удержания и авансы здесь не
            рассчитываются.
          </p>
        </div>
      </SectionCard>

      {query.isLoading ? (
        <SectionCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">Загружаем архив отчётов…</p>
        </SectionCard>
      ) : query.isError ? (
        <SectionCard>
          <p role="alert" className="text-sm text-rose-600">
            Не удалось загрузить архив. Попробуйте обновить страницу.
          </p>
        </SectionCard>
      ) : query.data?.reports.length ? (
        <SectionCard>
          <h2 className="mb-4 font-semibold">Архив отчётов</h2>
          <Table className="dark:text-slate-100">
            <TableHeader className="dark:bg-slate-800">
              <TableRow className="dark:border-slate-700 dark:hover:bg-slate-800">
                <TableHead className="dark:text-slate-300">Период</TableHead>
                <TableHead className="text-right dark:text-slate-300">Мастеров</TableHead>
                <TableHead className="text-right dark:text-slate-300">Работ</TableHead>
                <TableHead className="text-right dark:text-slate-300">Начислено</TableHead>
                <TableHead className="dark:text-slate-300">МАКС</TableHead>
                <TableHead className="text-right dark:text-slate-300">Файл</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.reports.map((report) => {
                const downloading =
                  downloadMutation.isPending && downloadMutation.variables?.reportId === report.id;
                return (
                  <TableRow
                    key={report.id}
                    className="dark:border-slate-800 dark:hover:bg-slate-800"
                  >
                    <TableCell className="font-medium">
                      {formatPeriod(report.periodStart, report.periodEnd)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {report.technicianCount}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{report.workCount}</TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatRubles(report.totalSalaryRub)}
                    </TableCell>
                    <TableCell className="min-w-56 text-xs text-slate-600 dark:text-slate-300">
                      {getDeliveryLabel(report)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        disabled={downloadMutation.isPending}
                        onClick={() =>
                          downloadMutation.mutate({
                            reportId: report.id,
                            fileName: report.fileName,
                          })
                        }
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200 dark:hover:bg-emerald-950"
                        aria-label={`Скачать отчёт за ${formatPeriod(report.periodStart, report.periodEnd)}`}
                      >
                        <Download size={16} aria-hidden="true" />
                        {downloading ? "Готовим…" : "XLSX"}
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </SectionCard>
      ) : (
        <SectionCard>
          <p className="font-medium">Отчётов пока нет</p>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Первый файл появится после окончания месяца и будет доступен здесь для скачивания.
          </p>
        </SectionCard>
      )}
    </div>
  );
};
