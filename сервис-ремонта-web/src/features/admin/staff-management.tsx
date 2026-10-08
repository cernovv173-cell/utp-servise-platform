import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UserRound, UserRoundX } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { StaffCreateForm } from "@/features/admin/staff-create-form";
import { useAuth } from "@/features/auth/auth-context";

import { deleteTechnician, getStaff, setStaffActive, updateTechnician } from "@/lib/api";

export const StaffManagement = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [draftRates, setDraftRates] = useState<Record<string, string>>({});
  const staff = useQuery({
    queryKey: ["staff", token],
    queryFn: ({ signal }) => getStaff(token!, signal),
    enabled: Boolean(token && user?.role === "ADMIN"),
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["staff", token] });
  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteTechnician(token!, userId),
    onSuccess: async ({ staff: removed }) => {
      setConfirmingId(null);
      toast.success(
        `Учётная запись мастера ${removed.displayName} удалена без возможности восстановления. Чеки и начисления сохранены без привязки к нему.`,
      );
      await refresh();
    },
    onError: () =>
      toast.error(
        "Не удалось удалить мастера. Проверьте его незавершённые заявки и связанные клиентские записи.",
      ),
  });
  const activeMutation = useMutation({
    mutationFn: ({ userId, active }: { userId: string; active: boolean }) =>
      setStaffActive(token!, userId, active),
    onSuccess: refresh,
    onError: () => toast.error("Не удалось изменить доступ сотрудника."),
  });
  const rateMutation = useMutation({
    mutationFn: ({ userId, salaryRatePercent }: { userId: string; salaryRatePercent: number }) =>
      updateTechnician(token!, userId, { salaryRatePercent }),
    onSuccess: async ({ staff: updated }) => {
      setDraftRates((current) => {
        const next = { ...current };
        delete next[updated.id];
        return next;
      });
      toast.success(
        `Ставка мастера ${updated.displayName} сохранена: ${updated.salaryRatePercent}%.`,
      );
      await refresh();
    },
    onError: () => toast.error("Не удалось сохранить ставку. Укажите целое число от 0 до 100."),
  });

  return (
    <SectionCard>
      <div className="flex items-start gap-3">
        <UserRound className="mt-0.5 text-blue-600" size={19} />
        <div>
          <h2 className="font-semibold">Сотрудники</h2>
          <p className="mt-1 text-sm text-slate-500">
            Доступ можно отключить и восстановить. Удаление мастера безвозвратно; история ремонта и
            документы сохраняются.
          </p>
        </div>
      </div>
      <StaffCreateForm onCreated={refresh} />
      {staff.isLoading && (
        <p className="mt-4 text-sm text-slate-500">Загружаем список сотрудников…</p>
      )}
      {staff.isError && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          Не удалось загрузить сотрудников.
        </p>
      )}
      <div className="mt-4 grid gap-3">
        {(staff.data?.staff ?? []).map((member) => (
          <article
            key={member.id}
            className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">{member.displayName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {member.email} · {member.role === "ADMIN" ? "Администратор" : "Мастер"} ·{" "}
                  {member.active ? "Активен" : "Отключён"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {member.id !== user?.id && (
                  <button
                    type="button"
                    disabled={activeMutation.isPending}
                    onClick={() =>
                      activeMutation.mutate({ userId: member.id, active: !member.active })
                    }
                    className="min-h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
                  >
                    {member.active ? "Отключить" : "Восстановить доступ"}
                  </button>
                )}
                {member.role === "TECHNICIAN" && (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(confirmingId === member.id ? null : member.id)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-rose-200 px-3 text-sm font-medium text-rose-700 dark:border-rose-900 dark:text-rose-300"
                  >
                    <UserRoundX size={16} /> Удалить навсегда
                  </button>
                )}
              </div>
            </div>
            {member.role === "TECHNICIAN" && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const rate = Number(draftRates[member.id] ?? member.salaryRatePercent ?? 75);
                  if (!Number.isInteger(rate) || rate < 0 || rate > 100) {
                    toast.error("Укажите целое число от 0 до 100.");
                    return;
                  }
                  rateMutation.mutate({ userId: member.id, salaryRatePercent: rate });
                }}
                className="mt-4 flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"
              >
                <label className="grid gap-1 text-sm font-medium">
                  Процент от стоимости услуг
                  <span className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      required
                      value={draftRates[member.id] ?? String(member.salaryRatePercent ?? 75)}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setDraftRates((current) => ({ ...current, [member.id]: value }));
                      }}
                      className="h-10 w-24 rounded-lg border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <span>%</span>
                  </span>
                  <span className="text-xs font-normal text-slate-500">
                    Запчасти и товары не учитываются. Новая ставка применяется к будущим
                    начислениям.
                  </span>
                </label>
                <button
                  type="submit"
                  disabled={rateMutation.isPending}
                  className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {rateMutation.isPending ? "Сохраняем…" : "Сохранить процент"}
                </button>
              </form>
            )}
            {confirmingId === member.id && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                <p>
                  Учётная запись {member.displayName} будет удалена без возможности восстановления,
                  а сеансы завершены. Завершённые заявки, чеки и начисления сохранятся без привязки
                  к мастеру. Сначала переназначьте или завершите все незавершённые заявки.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(member.id)}
                    className="min-h-9 rounded-lg bg-rose-600 px-3 font-semibold text-white disabled:opacity-60"
                  >
                    {deleteMutation.isPending ? "Удаляем…" : "Подтвердить удаление"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingId(null)}
                    className="min-h-9 rounded-lg border border-amber-300 px-3 font-medium dark:border-amber-800"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
        {!staff.isLoading && (staff.data?.staff.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500">Сотрудников пока нет.</p>
        )}
      </div>
    </SectionCard>
  );
};
