import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { updateProfile } from "@/lib/api";

const AccountPage = () => {
  const { token, user, logout } = useAuth();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const mutation = useMutation({
    mutationFn: () => updateProfile(token!, phone),
    onSuccess: async ({ user: updated }) => {
      queryClient.setQueryData(["auth", "me", token], { user: updated });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Контакт сохранён");
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    mutation.mutate();
  };
  return (
    <AppShell active="/account">
      <PageTitle
        eyebrow="ПРОФИЛЬ"
        title="Личный кабинет"
        description="Ваши контактные данные и настройки доступа."
      />
      <div className="grid gap-5 lg:grid-cols-2">
        <SectionCard>
          <h2 className="font-semibold">Профиль</h2>
          <p className="mt-1 text-sm text-slate-500">
            {user?.displayName} · {user?.email}
          </p>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Телефон
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                maxLength={32}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <button
              disabled={mutation.isPending}
              className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              Сохранить
            </button>
            {mutation.isError && (
              <p role="alert" className="text-sm text-rose-600">
                Не удалось сохранить номер телефона.
              </p>
            )}
          </form>
        </SectionCard>
        <SectionCard>
          <h2 className="font-semibold">Доступ</h2>
          <p className="mt-2 text-sm text-slate-500">
            Роль:{" "}
            {user?.role === "ADMIN"
              ? "Администратор"
              : user?.role === "TECHNICIAN"
                ? "Мастер"
                : "Клиент"}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Если вы забыли пароль, восстановление по электронной почте пока недоступно: почтовый
            сервис не подключён. Для помощи обратитесь к администратору.
          </p>
          <button
            onClick={logout}
            className="mt-5 min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            Выйти из аккаунта
          </button>
        </SectionCard>
      </div>
    </AppShell>
  );
};
export const Route = createFileRoute("/account")({ component: AccountPage });
