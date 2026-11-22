import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";
import { Select } from "@/components/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/table";

import { useAuth } from "@/features/auth/auth-context";

import {
  type MonthlySalaryReport,
  type TechnicianPayrollAdjustmentType,
  createMonthlySalaryReportAdjustment,
  getMonthlySalaryReportAdjustments,
  voidMonthlySalaryReportAdjustment,
} from "@/lib/api";

const adjustmentTypeLabels: Record<TechnicianPayrollAdjustmentType, string> = {
  TAX: "Налог",
  ADVANCE: "Аванс",
  DEDUCTION: "Удержание",
};

const adjustmentTypeOptions = Object.entries(adjustmentTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

const formatRubles = (amount: number) => `${amount.toLocaleString("ru-RU")} ₽`;

const formatDate = (value: string) => {
  const [year, month, day] = value.slice(0, 10).split("-");
  return `${day}.${month}.${year}`;
};

const fieldClassName =
  "min-h-10 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-normal text-slate-950 outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

export const MonthlySalaryReportAdjustmentEditor = ({
  report,
}: {
  report: MonthlySalaryReport;
}) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [adjustmentType, setAdjustmentType] = useState<TechnicianPayrollAdjustmentType>("TAX");
  const [technicianId, setTechnicianId] = useState("");
  const [occurredAt, setOccurredAt] = useState(report.periodEnd.slice(0, 10));
  const [amountInput, setAmountInput] = useState("");
  const [descriptionInput, setDescriptionInput] = useState("");
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const queryKey = ["admin-monthly-salary-report-adjustments", token, report.id];
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getMonthlySalaryReportAdjustments(token!, report.id, signal),
    enabled: Boolean(token),
  });
  const invalidateReports = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: ["admin-monthly-salary-reports", token] }),
    ]);
  };
  const createMutation = useMutation({
    mutationFn: (input: {
      technicianId: string;
      type: TechnicianPayrollAdjustmentType;
      amountRub: number;
      description: string;
      occurredAt: string;
    }) => createMonthlySalaryReportAdjustment(token!, report.id, input),
    onSuccess: async ({ workbookCurrent }) => {
      setAmountInput("");
      setDescriptionInput("");
      toast.success(
        workbookCurrent
          ? "Запись добавлена; Excel обновлён."
          : "Запись добавлена; Excel обновляется, скачайте его чуть позже.",
      );
      await invalidateReports();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось добавить запись."),
  });
  const voidMutation = useMutation({
    mutationFn: ({ adjustmentId, reason }: { adjustmentId: string; reason: string }) =>
      voidMonthlySalaryReportAdjustment(token!, report.id, adjustmentId, reason),
    onSuccess: async ({ workbookCurrent }) => {
      setVoidingId(null);
      setVoidReason("");
      toast.success(
        workbookCurrent
          ? "Запись отменена; Excel пересчитан."
          : "Запись отменена; Excel обновляется, скачайте его чуть позже.",
      );
      await invalidateReports();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отменить запись."),
  });
  const technicians = query.data?.settlements.filter(
    (settlement) => settlement.technicianId !== null,
  );
  const technicianOptions =
    technicians?.map((technician) => ({
      value: technician.technicianId!,
      label: technician.technicianName,
    })) ?? [];
  const selectedTechnicianId = technicianOptions.some((option) => option.value === technicianId)
    ? technicianId
    : technicianOptions[0]?.value || "";

  const submitAdjustment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amountRub = Number(amountInput);
    const description = descriptionInput.trim();
    if (!selectedTechnicianId || !Number.isSafeInteger(amountRub) || amountRub < 1) {
      toast.error("Выберите мастера и укажите сумму в целых рублях.");
      return;
    }
    createMutation.mutate({
      technicianId: selectedTechnicianId,
      type: adjustmentType,
      amountRub,
      description,
      occurredAt,
    });
  };

  return (
    <SectionCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Учёт налога, авансов и удержаний</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Период: {formatDate(report.periodStart)} — {formatDate(report.periodEnd)}. Налог
            вносится вручную; система не рассчитывает налоговую ставку.
          </p>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Остаток = начислено − налог − авансы − удержания
        </p>
      </div>

      {query.isLoading ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Загружаем начисления…</p>
      ) : query.isError ? (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          Не удалось загрузить данные за этот месяц.
        </p>
      ) : query.data ? (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {[
              ["Начислено", query.data.totals.salaryRub],
              ["Налог", query.data.totals.taxRub],
              ["Авансы", query.data.totals.advanceRub],
              ["Удержания", query.data.totals.deductionRub],
              ["К выплате", query.data.totals.netPayRub],
            ].map(([label, amount]) => (
              <div
                key={label}
                className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
                <p className="mt-1 font-semibold tabular-nums">{formatRubles(Number(amount))}</p>
              </div>
            ))}
          </div>

          <form
            className="mt-5 grid gap-3 rounded-xl border border-slate-200 p-4 sm:grid-cols-2 lg:grid-cols-5 dark:border-slate-800"
            onSubmit={submitAdjustment}
          >
            <label className="grid gap-1 text-sm font-medium">
              <span>Мастер</span>
              <Select
                ariaLabel="Мастер для записи"
                options={technicianOptions}
                value={selectedTechnicianId}
                onValueChange={setTechnicianId}
                disabled={!technicianOptions.length || createMutation.isPending}
                placeholder="Выберите мастера"
                className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                contentClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <span>Тип записи</span>
              <Select
                ariaLabel="Тип расчётной записи"
                options={adjustmentTypeOptions}
                value={adjustmentType}
                onValueChange={(value) =>
                  setAdjustmentType(value as TechnicianPayrollAdjustmentType)
                }
                disabled={createMutation.isPending}
                className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
                contentClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <span>Дата</span>
              <input
                type="date"
                required
                value={occurredAt}
                min={report.periodStart.slice(0, 10)}
                max={report.periodEnd.slice(0, 10)}
                onChange={(event) => setOccurredAt(event.target.value)}
                className={fieldClassName}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              <span>Сумма, ₽</span>
              <input
                name="amountRub"
                type="number"
                value={amountInput}
                onChange={(event) => setAmountInput(event.target.value)}
                min="1"
                max="50000000"
                step="1"
                required
                className={fieldClassName}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium sm:col-span-2 lg:col-span-1">
              <span>Основание</span>
              <input
                name="description"
                type="text"
                value={descriptionInput}
                onChange={(event) => setDescriptionInput(event.target.value)}
                minLength={1}
                maxLength={250}
                required
                placeholder="Например, аванс от 15 числа"
                className={fieldClassName}
              />
            </label>
            <button
              type="submit"
              disabled={
                createMutation.isPending ||
                !selectedTechnicianId ||
                !occurredAt ||
                !technicianOptions.length
              }
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50 sm:col-span-2 lg:col-span-5 lg:justify-self-start"
            >
              {createMutation.isPending ? "Сохраняем…" : "Добавить запись"}
            </button>
          </form>

          <div className="mt-6">
            <h3 className="mb-3 font-semibold">История расчётных записей</h3>
            {query.data.adjustments.length ? (
              <div className="overflow-x-auto">
                <Table className="min-w-[860px] dark:text-slate-100">
                  <TableHeader className="dark:bg-slate-800">
                    <TableRow className="dark:border-slate-700 dark:hover:bg-slate-800">
                      <TableHead className="dark:text-slate-300">Дата</TableHead>
                      <TableHead className="dark:text-slate-300">Мастер</TableHead>
                      <TableHead className="dark:text-slate-300">Тип</TableHead>
                      <TableHead className="dark:text-slate-300">Основание</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Сумма</TableHead>
                      <TableHead className="dark:text-slate-300">Статус</TableHead>
                      <TableHead className="text-right dark:text-slate-300">Действие</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {query.data.adjustments.map((adjustment) => (
                      <TableRow
                        key={adjustment.id}
                        className="dark:border-slate-800 dark:hover:bg-slate-800"
                      >
                        <TableCell>{formatDate(adjustment.occurredAt)}</TableCell>
                        <TableCell>{adjustment.technicianName}</TableCell>
                        <TableCell>{adjustmentTypeLabels[adjustment.type]}</TableCell>
                        <TableCell>
                          <span>{adjustment.description}</span>
                          <span className="mt-1 block text-xs text-slate-500">
                            Записал: {adjustment.createdByName}
                          </span>
                          {adjustment.voidReason ? (
                            <span className="mt-1 block text-xs text-slate-500">
                              Причина отмены: {adjustment.voidReason}
                            </span>
                          ) : null}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatRubles(adjustment.amountRub)}
                        </TableCell>
                        <TableCell>{adjustment.voidedAt ? "Отменено" : "Действует"}</TableCell>
                        <TableCell className="text-right">
                          {adjustment.voidedAt ? null : voidingId === adjustment.id ? (
                            <form
                              className="grid min-w-56 gap-2"
                              onSubmit={(event: FormEvent<HTMLFormElement>) => {
                                event.preventDefault();
                                const reason = voidReason.trim();
                                if (!reason) {
                                  toast.error("Укажите причину отмены.");
                                  return;
                                }
                                voidMutation.mutate({ adjustmentId: adjustment.id, reason });
                              }}
                            >
                              <input
                                aria-label="Причина отмены записи"
                                value={voidReason}
                                onChange={(event) => setVoidReason(event.target.value)}
                                maxLength={250}
                                required
                                placeholder="Причина отмены"
                                className={fieldClassName}
                              />
                              <div className="flex justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setVoidingId(null);
                                    setVoidReason("");
                                  }}
                                  className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold dark:border-slate-700"
                                >
                                  Назад
                                </button>
                                <button
                                  type="submit"
                                  disabled={voidMutation.isPending}
                                  className="min-h-9 rounded-lg bg-rose-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  Отменить
                                </button>
                              </div>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setVoidingId(adjustment.id);
                                setVoidReason("");
                              }}
                              className="min-h-9 rounded-lg border border-rose-200 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/30"
                            >
                              Отменить
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                За этот период дополнительных записей нет.
              </p>
            )}
          </div>
        </>
      ) : null}
    </SectionCard>
  );
};
