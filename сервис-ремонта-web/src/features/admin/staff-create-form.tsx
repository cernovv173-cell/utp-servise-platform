import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { StaffPermissionCheckboxes } from "@/features/admin/staff-permission-checkboxes";
import { useAuth } from "@/features/auth/auth-context";
import { isFullAdministrator } from "@/features/auth/staff-access";

import type { StaffPermission, StaffPermissionOption } from "@/lib/api";
import { createStaff } from "@/lib/api";

type CreatedAccount = {
  login: string;
  email: string;
  displayName: string;
  permissions: StaffPermission[];
  fullAdministrator: boolean;
  temporaryPassword: string;
};

export const StaffCreateForm = ({
  onCreated,
  permissionOptions,
}: {
  onCreated: () => Promise<unknown> | unknown;
  permissionOptions: StaffPermissionOption[];
}) => {
  const { token, user } = useAuth();
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [fullAdministrator, setFullAdministrator] = useState(false);
  const create = useMutation({
    mutationFn: (input: {
      email: string;
      displayName: string;
      phoneNumber?: string;
      permissions: StaffPermission[];
      fullAdministrator: boolean;
    }) => createStaff(token!, input),
    onSuccess: async ({ staff, temporaryPassword }) => {
      setCreatedAccount({
        login: staff.login ?? staff.email,
        email: staff.email,
        displayName: staff.displayName,
        permissions: staff.permissions ?? [],
        fullAdministrator: staff.role === "ADMIN" && !staff.isAdminAssistant,
        temporaryPassword,
      });
      await onCreated();
      toast.success("Учётная запись сотрудника создана. Передайте ему данные для первого входа.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось создать сотрудника."),
  });

  return (
    <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="font-semibold">Добавить сотрудника</h3>
      <p className="mt-1 text-sm text-slate-500">
        Назначьте сотруднику доступ к нужным разделам. Права можно изменить позже; при первом входе
        ему потребуется задать новый пароль.
      </p>
      <form
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const phoneNumber = String(data.get("phoneNumber")).trim();
          create.mutate(
            {
              displayName: String(data.get("displayName")).trim(),
              email: String(data.get("email")).trim(),
              permissions: fullAdministrator ? [] : permissions,
              fullAdministrator,
              ...(phoneNumber ? { phoneNumber } : {}),
            },
            {
              onSuccess: () => {
                form.reset();
                setPermissions([]);
                setFullAdministrator(false);
              },
            },
          );
        }}
      >
        <div className="grid gap-4 sm:col-span-2 lg:col-span-3">
          {isFullAdministrator(user) && (
            <label className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
              <input
                type="checkbox"
                checked={fullAdministrator}
                disabled={create.isPending}
                onChange={(event) => setFullAdministrator(event.currentTarget.checked)}
                className="mt-0.5 size-4 accent-amber-600"
              />
              <span>
                <span className="block text-sm font-semibold">Полный доступ администратора</span>
                <span className="mt-1 block text-xs text-slate-600 dark:text-slate-300">
                  Доступ ко всем разделам и управлению учётными записями.
                </span>
              </span>
            </label>
          )}
          {!fullAdministrator && (
            <StaffPermissionCheckboxes
              options={permissionOptions}
              selected={permissions}
              onChange={setPermissions}
              disabled={create.isPending}
            />
          )}
        </div>
        <label className="grid gap-1 text-sm font-medium">
          <span>
            Имя сотрудника{"\u00a0"}
            <span aria-hidden="true">*</span>
          </span>
          <input
            name="displayName"
            required
            minLength={2}
            maxLength={120}
            autoComplete="name"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          <span>
            Рабочая электронная почта{"\u00a0"}
            <span aria-hidden="true">*</span>
          </span>
          <input
            name="email"
            type="email"
            required
            maxLength={320}
            autoComplete="email"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Телефон
          <input
            name="phoneNumber"
            type="tel"
            maxLength={32}
            autoComplete="tel"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="submit"
          disabled={create.isPending || (!fullAdministrator && permissionOptions.length === 0)}
          className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-3 lg:justify-self-start"
        >
          {create.isPending ? "Создаём учётную запись…" : "Добавить сотрудника"}
        </button>
      </form>
      {createdAccount && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">
                Данные для первого входа · {createdAccount.displayName} ·{" "}
                {createdAccount.fullAdministrator
                  ? "Полный доступ администратора"
                  : createdAccount.permissions.length > 0
                    ? `Права: ${permissionOptions
                        .filter((option) => createdAccount.permissions.includes(option.key))
                        .map((option) => option.label)
                        .join(", ")}`
                    : "Без прав доступа"}
              </h4>
              <p className="mt-2">Логин: {createdAccount.login}</p>
              <p className="mt-1">Рабочая почта: {createdAccount.email}</p>
              <p className="mt-1">
                Временный пароль:{" "}
                <code className="font-semibold select-all">{createdAccount.temporaryPassword}</code>
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreatedAccount(null)}
              className="min-h-9 rounded-lg border border-emerald-700/30 px-3 text-xs font-semibold dark:border-emerald-200/30"
            >
              Скрыть данные
            </button>
          </div>
          <p className="mt-3 text-xs">
            Сохраните и передайте пароль сотруднику безопасным способом: после закрытия этого блока
            повторно показать его будет нельзя.
          </p>
        </div>
      )}
    </section>
  );
};
