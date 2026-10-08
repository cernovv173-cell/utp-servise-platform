import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import { createTechnician } from "@/lib/api";

type CreatedAccount = {
  email: string;
  displayName: string;
  temporaryPassword: string;
};

export const StaffCreateForm = ({ onCreated }: { onCreated: () => Promise<unknown> | unknown }) => {
  const { token } = useAuth();
  const [createdAccount, setCreatedAccount] = useState<CreatedAccount | null>(null);
  const create = useMutation({
    mutationFn: (input: { email: string; displayName: string; phoneNumber?: string }) =>
      createTechnician(token!, input),
    onSuccess: async ({ staff, temporaryPassword }) => {
      setCreatedAccount({
        email: staff.email,
        displayName: staff.displayName,
        temporaryPassword,
      });
      await onCreated();
      toast.success("Учётная запись мастера создана. Передайте ему данные для первого входа.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось создать сотрудника."),
  });

  return (
    <section className="mt-5 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <h3 className="font-semibold">Добавить сотрудника</h3>
      <p className="mt-1 text-sm text-slate-500">
        Будет создана учётная запись мастера с временным паролем. При первом входе сотрудник задаст
        новый пароль.
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
              ...(phoneNumber ? { phoneNumber } : {}),
            },
            { onSuccess: () => form.reset() },
          );
        }}
      >
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
            Электронная почта — логин{"\u00a0"}
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
          disabled={create.isPending}
          className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 lg:col-span-3 lg:justify-self-start"
        >
          {create.isPending ? "Создаём учётную запись…" : "Добавить мастера"}
        </button>
      </form>
      {createdAccount && (
        <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h4 className="font-semibold">
                Данные для первого входа · {createdAccount.displayName}
              </h4>
              <p className="mt-2">Логин: {createdAccount.email}</p>
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
