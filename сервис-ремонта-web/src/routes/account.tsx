import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  changePassword,
  disconnectMax,
  disconnectTelegram,
  getMaxStatus,
  getTelegramStatus,
  requestMaxLink,
  requestTelegramLink,
  updateProfile,
} from "@/lib/api";

const AccountPage = () => {
  const { token, user, logout, setSession } = useAuth();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState(user?.phoneNumber ?? "");
  const [gender, setGender] = useState(user?.gender ?? "");
  const [birthDate, setBirthDate] = useState(user?.birthDate ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [telegramLink, setTelegramLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [maxLink, setMaxLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const telegramStatus = useQuery({
    queryKey: ["telegram-status", token],
    queryFn: ({ signal }) => getTelegramStatus(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
    refetchInterval: (query) => (!query.state.data?.connected && telegramLink ? 2_000 : false),
  });
  const telegramLinkMutation = useMutation({
    mutationFn: () => requestTelegramLink(token!),
    onSuccess: (link) => setTelegramLink(link),
  });
  const telegramDisconnectMutation = useMutation({
    mutationFn: () => disconnectTelegram(token!),
    onSuccess: async () => {
      setTelegramLink(null);
      await queryClient.invalidateQueries({ queryKey: ["telegram-status", token] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me", token] });
      toast.success("Уведомления Telegram отключены");
    },
  });
  const maxStatus = useQuery({
    queryKey: ["max-status", token],
    queryFn: ({ signal }) => getMaxStatus(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
    refetchInterval: (query) => (!query.state.data?.connected && maxLink ? 2_000 : false),
  });
  const maxLinkMutation = useMutation({
    mutationFn: () => requestMaxLink(token!),
    onSuccess: (link) => setMaxLink(link),
  });
  const maxDisconnectMutation = useMutation({
    mutationFn: () => disconnectMax(token!),
    onSuccess: async () => {
      setMaxLink(null);
      await queryClient.invalidateQueries({ queryKey: ["max-status", token] });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me", token] });
      toast.success("Уведомления MAX отключены");
    },
  });
  const mutation = useMutation({
    mutationFn: () =>
      updateProfile(
        token!,
        phone,
        user?.role === "CUSTOMER" ? (gender as "MALE" | "FEMALE" | "") || null : undefined,
        user?.role === "CUSTOMER" ? birthDate || null : undefined,
      ),
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
  const passwordMutation = useMutation({
    mutationFn: () => changePassword(token!, currentPassword, newPassword),
    onSuccess: (session) => {
      queryClient.clear();
      setSession(session);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordError(null);
      toast.success("Пароль изменён. Выполнен вход с новым паролем.");
    },
    onError: () =>
      setPasswordError("Не удалось сменить пароль. Проверьте текущий пароль и повторите попытку."),
  });
  const submitPassword = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);
    if (newPassword.length < 8) {
      setPasswordError("Новый пароль должен содержать не менее 8 символов.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Новые пароли не совпадают.");
      return;
    }
    passwordMutation.mutate();
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
            {user?.role === "CUSTOMER" && (
              <>
                <label className="grid gap-1.5 text-sm font-medium">
                  Пол <span className="font-normal text-slate-500">(необязательно)</span>
                  <select
                    value={gender}
                    onChange={(event) => setGender(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
                  >
                    <option value="">Не указан</option>
                    <option value="FEMALE">Женский</option>
                    <option value="MALE">Мужской</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  Дата рождения <span className="font-normal text-slate-500">(необязательно)</span>
                  <input
                    type="date"
                    value={birthDate}
                    max={new Date().toISOString().slice(0, 10)}
                    onChange={(event) => setBirthDate(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
                  />
                </label>
                <p className="text-xs leading-5 text-slate-500">
                  Если дата рождения указана и на устройстве разрешены уведомления, сервис отправит
                  поздравление в этот день.
                </p>
              </>
            )}
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
        {user?.role === "CUSTOMER" && (
          <SectionCard>
            <h2 className="font-semibold">Уведомления в Telegram</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Получайте сообщения, когда устройство принято, диагностика завершена и заказ готов к
              выдаче.
            </p>
            {(telegramStatus.data?.connected ?? user.telegramLinked) ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  Telegram подключён
                </span>
                <button
                  type="button"
                  disabled={telegramDisconnectMutation.isPending}
                  onClick={() => telegramDisconnectMutation.mutate()}
                  className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Отключить
                </button>
              </div>
            ) : telegramLink ? (
              <div className="mt-4 grid justify-items-start gap-2">
                <a
                  href={telegramLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Открыть Telegram и подтвердить
                </a>
                <p className="text-xs text-slate-500">
                  Ссылка действует до {new Date(telegramLink.expiresAt).toLocaleTimeString("ru-RU")}
                  . Статус обновится автоматически после подтверждения.
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={telegramLinkMutation.isPending}
                onClick={() => telegramLinkMutation.mutate()}
                className="mt-4 min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {telegramLinkMutation.isPending ? "Создаём ссылку…" : "Подключить Telegram"}
              </button>
            )}
            {telegramLinkMutation.isError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                Не удалось создать ссылку. Попробуйте ещё раз позже.
              </p>
            )}
            {telegramDisconnectMutation.isError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                Не удалось отключить Telegram. Попробуйте ещё раз.
              </p>
            )}
            {telegramStatus.isError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                Не удалось проверить подключение Telegram.
              </p>
            )}
          </SectionCard>
        )}
        {user?.role === "CUSTOMER" && (
          <SectionCard>
            <h2 className="font-semibold">Уведомления в MAX</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Получайте сообщения, когда устройство принято, диагностика завершена и заказ готов к
              выдаче.
            </p>
            {maxStatus.isLoading ? (
              <p className="mt-3 text-sm text-slate-500">Проверяем подключение MAX…</p>
            ) : maxStatus.isError ? (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                Не удалось проверить подключение MAX.
              </p>
            ) : !maxStatus.data?.available ? (
              <p className="mt-3 text-sm text-slate-500">
                Подключение MAX не настроено; уведомления в MAX пока недоступны.
              </p>
            ) : (maxStatus.data.connected ?? user.maxLinked) ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                  MAX подключён
                </span>
                <button
                  type="button"
                  disabled={maxDisconnectMutation.isPending}
                  onClick={() => maxDisconnectMutation.mutate()}
                  className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  Отключить
                </button>
              </div>
            ) : maxLink ? (
              <div className="mt-4 grid justify-items-start gap-2">
                <a
                  href={maxLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Открыть MAX и подтвердить
                </a>
                <p className="text-xs text-slate-500">
                  Ссылка действует до {new Date(maxLink.expiresAt).toLocaleTimeString("ru-RU")}.
                  Статус обновится автоматически после подтверждения.
                </p>
              </div>
            ) : (
              <button
                type="button"
                disabled={maxLinkMutation.isPending}
                onClick={() => maxLinkMutation.mutate()}
                className="mt-4 min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {maxLinkMutation.isPending ? "Создаём ссылку…" : "Подключить MAX"}
              </button>
            )}
            {maxLinkMutation.isError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                Не удалось создать ссылку для MAX. Попробуйте ещё раз позже.
              </p>
            )}
            {maxDisconnectMutation.isError && (
              <p role="alert" className="mt-3 text-sm text-rose-600">
                Не удалось отключить MAX. Попробуйте ещё раз.
              </p>
            )}
          </SectionCard>
        )}
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
            Сменить пароль может каждый вошедший пользователь. После смены остальные активные сеансы
            будут завершены.
          </p>
          <form onSubmit={submitPassword} className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              Текущий пароль
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                required
                maxLength={128}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Новый пароль (не менее 8 символов)
              <input
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                required
                minLength={8}
                maxLength={128}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Повторите новый пароль
              <input
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                required
                maxLength={128}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            {passwordError && (
              <p role="alert" className="text-sm text-rose-600">
                {passwordError}
              </p>
            )}
            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {passwordMutation.isPending ? "Меняем пароль…" : "Сменить пароль"}
            </button>
          </form>
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
