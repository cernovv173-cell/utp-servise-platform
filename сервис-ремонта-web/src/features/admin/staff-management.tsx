import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Lock, Unlock, UserRound, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { StaffCreateForm } from "@/features/admin/staff-create-form";
import { useAuth } from "@/features/auth/auth-context";

import { getStaff, setStaffActive, terminateStaff, updateTechnician } from "@/lib/api";

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
  const terminateMutation = useMutation({
    mutationFn: (userId: string) => terminateStaff(token!, userId),
    onSuccess: async ({ staff: terminated }) => {
      setConfirmingId(null);
      toast.success(`Сотрудник ${terminated.displayName} уволен. История и документы сохранены.`);
      await refresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось уволить сотрудника."),
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
            Доступ можно временно отключить и восстановить. Увольнение навсегда закрывает вход,
            скрывает запись из этого списка, сохраняет историю и возвращает незавершённые заявки
            администраторам.
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
                  {member.email} · {roleLabel(member)} ·{" "}
                  {member.terminatedAt
                    ? `Уволен навсегда · ${new Date(member.terminatedAt).toLocaleDateString("ru-RU")}`
                    : member.active
                      ? "Активен"
                      : "Доступ временно отключён"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {member.role === "TECHNICIAN" && (
                  <Link
                    to="/staff/$technicianId"
                    params={{ technicianId: member.id }}
                    className="inline-flex min-h-9 items-center rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
                  >
                    Профиль мастера
                  </Link>
                )}
                {member.id !== user?.id && !member.terminatedAt && (
                  <button
                    type="button"
                    disabled={activeMutation.isPending}
                    aria-label={
                      member.active
                        ? `Скрыть доступ ${member.displayName}`
                        : `Показать доступ ${member.displayName}`
                    }
                    title={member.active ? "Скрыть доступ" : "Восстановить доступ"}
                    className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-slate-700"
                    onClick={() =>
                      activeMutation.mutate({ userId: member.id, active: !member.active })
                    }
                  >
                    {member.active ? (
                      <Lock size={16} aria-hidden="true" />
                    ) : (
                      <Unlock size={16} aria-hidden="true" />
                    )}
                  </button>
                )}
                {member.id !== user?.id && !member.terminatedAt && (
                  <button
                    type="button"
                    onClick={() => setConfirmingId(confirmingId === member.id ? null : member.id)}
                    aria-label={`Уволить навсегда ${member.displayName}`}
                    title="Уволить навсегда"
                    className="grid size-9 place-items-center rounded-lg border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                  >
                    <X size={16} aria-hidden="true" />
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
            {confirmingId === member.id && !member.terminatedAt && member.id !== user?.id && (
              <div className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
                <p>
                  Учётная запись {member.displayName} будет уволена навсегда: вход и связанные
                  сеансы будут закрыты. История, завершённые заявки, чеки и начисления сохранятся;
                  незавершённые заявки вернутся администраторам для переназначения. Восстановить
                  доступ нельзя.
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={terminateMutation.isPending}
                    onClick={() => terminateMutation.mutate(member.id)}
                    className="min-h-9 rounded-lg bg-rose-600 px-3 font-semibold text-white disabled:opacity-60"
                  >
                    {terminateMutation.isPending ? "Увольняем…" : "Уволить навсегда"}
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
          <p className="text-sm text-slate-500">Действующих записей сотрудников пока нет.</p>
        )}
      </div>
    </SectionCard>
  );
};

const roleLabel = (member: { role: string; isAdminAssistant?: boolean }) =>
  member.isAdminAssistant
    ? "Помощник администратора"
    : member.role === "ADMIN"
      ? "Администратор"
      : member.role === "PROCUREMENT"
        ? "Мастер закупки"
        : "Мастер";
