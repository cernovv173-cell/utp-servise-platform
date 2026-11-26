import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";
import { UserAvatar } from "@/components/user-avatar";

import { clearCustomerLocalData } from "@/features/account/account-local-data";
import { CustomerAvatarCard } from "@/features/account/customer-avatar-card";
import { MaxEmailLoginCard } from "@/features/account/max-email-login-card";
import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";
import { AccountQuickLinks } from "@/features/navigation/account-quick-links";
import { TechnicianQuestionnaireCard } from "@/features/staff/technician-questionnaire-card";

import {
  changePassword,
  deleteOwnAccount,
  disconnectMax,
  disconnectTelegram,
  getMaxStatus,
  getTelegramStatus,
  requestMaxLink,
  requestTelegramLink,
  updateProfile,
} from "@/lib/api";
import { getPhoneNumberError, phoneNumberPlaceholder } from "@/lib/phone";

const VK_COMMUNITY_URL = "https://vk.ru/remont_pk_puhkino";

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [telegramLink, setTelegramLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [maxLink, setMaxLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const telegramStatus = useQuery({
    queryKey: ["telegram-status", token],
    queryFn: ({ signal }) => getTelegramStatus(token!, signal),
    enabled: Boolean(token),
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
    const phoneError = getPhoneNumberError(phone, { required: user?.role === "CUSTOMER" });
    if (phoneError) {
      toast.error(phoneError);
      return;
    }
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
    onError: () => {
      const message = "Не удалось сменить пароль. Проверьте текущий пароль и повторите попытку.";
      setPasswordError(message);
      toast.error(message);
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteOwnAccount(token!),
    onSuccess: () => {
      if (user?.role === "CUSTOMER") clearCustomerLocalData(user.id);
      toast.success("Аккаунт и связанные данные удалены.");
      logout();
    },
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
      {user?.mustChangePassword && (
        <p
          role="status"
          className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100"
        >
          Для продолжения смените временный пароль, который передал администратор, на свой
          постоянный пароль.
        </p>
      )}
      <AccountQuickLinks role={user?.role} />
      <div className="grid gap-5 lg:grid-cols-2">
        {user?.role === "CUSTOMER" && token && <CustomerAvatarCard token={token} user={user} />}
        <SectionCard>
          <h2 className="font-semibold">Профиль</h2>
          {user && user.role !== "CUSTOMER" && (
            <div className="mt-3 flex items-center gap-3">
              <UserAvatar
                objectId={user.avatarObjectId}
                alt={`Аватар сотрудника ${user.displayName}`}
                className="size-14 rounded-full"
              />
              <span className="text-sm text-slate-500">Фирменный аватар сотрудника</span>
            </div>
          )}
          <p className="mt-1 text-sm text-slate-500">
            {user?.displayName} ·{" "}
            {user?.email ?? (user?.login ? `логин ${user.login}` : "вход через МАКС")}
          </p>
          <form onSubmit={submit} className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              Телефон{" "}
              {user?.role !== "CUSTOMER" && (
                <span className="font-normal text-slate-500">(необязательно)</span>
              )}
              <input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                type="tel"
                maxLength={32}
                inputMode="tel"
                autoComplete="tel"
                required={user?.role === "CUSTOMER"}
                placeholder={phoneNumberPlaceholder}
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
        {hasPermission(user, "repairs") && user.id && (
          <TechnicianQuestionnaireCard technicianId={user.id} />
        )}
        {user?.role === "CUSTOMER" && user.maxLinked && !user.email && token && (
          <MaxEmailLoginCard token={token} />
        )}
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
        {Boolean(user && token) && (
          <SectionCard>
            <h2 className="font-semibold">Вход и уведомления через МАКС</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Привяжите МАКС к своему аккаунту, чтобы входить через кнопку на экране входа и
              получать сообщения по заявкам. Привязка не меняет роль аккаунта.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {maxStatus.isLoading ? (
                <p className="text-sm text-slate-500">Проверяем подключение MAX…</p>
              ) : maxStatus.isError ? (
                <p role="alert" className="text-sm text-rose-600">
                  Не удалось проверить подключение MAX.
                </p>
              ) : !maxStatus.data?.available ? (
                <p className="text-sm text-slate-500">
                  Подключение МАКС временно недоступно. Попробуйте позже.
                </p>
              ) : (maxStatus.data.connected ?? user?.maxLinked) ? (
                <>
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
                </>
              ) : maxLink ? (
                <a
                  href={maxLink.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
                >
                  Открыть MAX и подтвердить
                </a>
              ) : (
                <button
                  type="button"
                  disabled={maxLinkMutation.isPending}
                  onClick={() => maxLinkMutation.mutate()}
                  className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {maxLinkMutation.isPending ? "Создаём ссылку…" : "Подключить MAX"}
                </button>
              )}
              <a
                href={VK_COMMUNITY_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center justify-center rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-700 transition hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:border-blue-400/30 dark:text-cyan-200 dark:hover:bg-blue-950/40"
              >
                Группа ВК
              </a>
              {maxLink && !maxStatus.data?.connected && (
                <p className="basis-full text-xs text-slate-500">
                  Ссылка действует до {new Date(maxLink.expiresAt).toLocaleTimeString("ru-RU")}.
                  Статус обновится автоматически после подтверждения.
                </p>
              )}
            </div>
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
            {user?.role === "CUSTOMER"
              ? "Клиент"
              : user?.role === "ADMIN" && !user.isAdminAssistant
                ? "Администратор с полным доступом"
                : "Сотрудник"}
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Сменить пароль может каждый вошедший пользователь. После смены остальные активные сеансы
            будут завершены.
          </p>
          <form onSubmit={submitPassword} className="mt-4 grid gap-3">
            <label className="grid gap-1.5 text-sm font-medium">
              {user?.mustChangePassword ? "Временный пароль от администратора" : "Текущий пароль"}
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
        {user?.role === "CUSTOMER" && (
          <SectionCard className="border-rose-200 dark:border-rose-900">
            <h2 className="font-semibold text-rose-700 dark:text-rose-300">Удаление аккаунта</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Вы можете удалить свой аккаунт прямо здесь. Это действие нельзя отменить.
            </p>
            <button
              type="button"
              onClick={() => {
                deleteAccountMutation.reset();
                setDeleteDialogOpen(true);
              }}
              className="mt-4 min-h-10 rounded-xl border border-rose-300 px-4 text-sm font-semibold text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-300 dark:hover:bg-rose-950/40"
            >
              Удалить аккаунт
            </button>
            {deleteAccountMutation.isError && !deleteDialogOpen && (
              <p role="alert" className="mt-3 text-sm text-rose-600 dark:text-rose-300">
                Не удалось завершить запрос. Проверьте соединение и попробуйте ещё раз.
              </p>
            )}
          </SectionCard>
        )}
      </div>
      {user?.role === "CUSTOMER" && (
        <Modal
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            if (!deleteAccountMutation.isPending) setDeleteDialogOpen(open);
          }}
        >
          <ModalContent className="border-slate-200 bg-white text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
            <ModalHeader>
              <ModalTitle>Удалить аккаунт безвозвратно?</ModalTitle>
              <ModalDescription asChild>
                <div className="mt-3 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
                  <p>
                    Будут удалены аккаунт и связанные данные: заявки и история ремонтов, заказы
                    магазина и изделий, переписки, отзывы, фотографии, бонусы. Незавершённые заявки
                    тоже будут удалены.
                  </p>
                  <p>Восстановить аккаунт и данные после удаления нельзя.</p>
                </div>
              </ModalDescription>
            </ModalHeader>
            {deleteAccountMutation.isError && (
              <p role="alert" className="mt-4 text-sm text-rose-600 dark:text-rose-300">
                Не удалось завершить запрос. Проверьте соединение и попробуйте ещё раз позже.
              </p>
            )}
            <ModalFooter>
              <button
                type="button"
                onClick={() => setDeleteDialogOpen(false)}
                disabled={deleteAccountMutation.isPending}
                className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={deleteAccountMutation.isPending}
                onClick={() => deleteAccountMutation.mutate()}
                className="min-h-10 rounded-xl bg-rose-600 px-4 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {deleteAccountMutation.isPending ? "Удаляем…" : "Удалить"}
              </button>
            </ModalFooter>
          </ModalContent>
        </Modal>
      )}
      <a
        href="/privacy-policy.html"
        className="mt-5 inline-flex text-sm font-medium text-blue-700 underline underline-offset-4 hover:text-blue-800 dark:text-cyan-300 dark:hover:text-cyan-200"
      >
        Политика конфиденциальности
      </a>
    </AppShell>
  );
};
export const Route = createFileRoute("/account")({ component: AccountPage });
