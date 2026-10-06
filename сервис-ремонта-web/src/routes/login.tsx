import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Wrench } from "lucide-react";
import { type FormEvent, useCallback, useState } from "react";

import { AppInstallButton } from "@/components/app-install-button";

import { useAuth } from "@/features/auth/auth-context";
import { VkIdLogin } from "@/features/auth/vk-id-login";
import { YandexIdLogin } from "@/features/auth/yandex-id-login";

import {
  ApiRequestError,
  type Role,
  loginRequest,
  registerRequest,
  requestPasswordReset,
  vkLoginRequest,
  yandexLoginRequest,
} from "@/lib/api";

const LoginPage = () => {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [registering, setRegistering] = useState(false);
  const [recovering, setRecovering] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [pendingYandexToken, setPendingYandexToken] = useState<string | null>(null);
  const [pendingVkToken, setPendingVkToken] = useState<string | null>(null);

  const authenticateWithYandex = async (accessToken: string, linkPassword?: string) => {
    setBusy(true);
    setError("");
    try {
      const session = await yandexLoginRequest(accessToken, role, linkPassword);
      setPendingYandexToken(null);
      setSession(session);
      await navigate({ to: "/" });
    } catch (failure) {
      if (failure instanceof ApiRequestError && failure.code === "YANDEX_PASSWORD_REQUIRED") {
        setPendingYandexToken(accessToken);
        setError("Для защиты существующего аккаунта введите его пароль и подтвердите привязку.");
      } else {
        setError(failure instanceof Error ? failure.message : "Не удалось выполнить вход.");
      }
    } finally {
      setBusy(false);
    }
  };

  const authenticateWithVk = useCallback(
    async (accessToken: string, linkPassword?: string) => {
      setBusy(true);
      setError("");
      try {
        const session = await vkLoginRequest(accessToken, role, linkPassword);
        setPendingVkToken(null);
        setSession(session);
        await navigate({ to: "/" });
      } catch (failure) {
        if (failure instanceof ApiRequestError && failure.code === "VK_PASSWORD_REQUIRED") {
          setPendingVkToken(accessToken);
          setError("Для защиты существующего аккаунта введите его пароль и подтвердите привязку.");
        } else {
          setError(failure instanceof Error ? failure.message : "Не удалось выполнить вход.");
        }
      } finally {
        setBusy(false);
      }
    },
    [navigate, role, setSession],
  );

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      if (recovering) {
        await requestPasswordReset(String(values.get("email")));
        setRecoverySent(true);
        return;
      }
      const session = registering
        ? await registerRequest(
            String(values.get("name")),
            String(values.get("email")),
            String(values.get("phone")),
            String(values.get("password")),
          )
        : await loginRequest(String(values.get("email")), String(values.get("password")), role);
      setSession(session);
      await navigate({ to: "/" });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось выполнить вход.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh bg-slate-50 lg:grid-cols-2 dark:bg-slate-950">
      <section className="flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-3 text-lg font-bold">
            <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white">
              <Wrench size={20} />
            </span>
            UTP Servise
          </Link>
          <h1 className="mt-10 text-3xl font-semibold">
            {recovering
              ? "Восстановление пароля"
              : registering
                ? "Создать аккаунт"
                : "Добро пожаловать!"}
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            {recovering
              ? "Укажите адрес аккаунта — мы отправим ссылку для создания нового пароля."
              : "Войдите, чтобы управлять заявками, получать новости и видеть историю ремонта."}
          </p>
          <div className="mt-4">
            <AppInstallButton />
          </div>
          <form onSubmit={submit} className="mt-8 grid gap-4">
            {registering && !recovering && (
              <label className="grid gap-1.5 text-sm font-medium">
                Имя
                <input
                  required
                  name="name"
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            )}
            <label className="grid gap-1.5 text-sm font-medium">
              Электронная почта
              <input
                required
                type="email"
                name="email"
                autoComplete="email"
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            {registering && !recovering && (
              <label className="grid gap-1.5 text-sm font-medium">
                Телефон, необязательно
                <input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            )}
            {!registering && !recovering && (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Войти как</legend>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["CUSTOMER", "Клиент"],
                      ["TECHNICIAN", "Мастер"],
                      ["ADMIN", "Администратор"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setRole(value)}
                      className={`min-h-10 rounded-xl border px-2 text-xs font-medium ${role === value ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950" : "border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {!recovering && (
              <label className="grid gap-1.5 text-sm font-medium">
                Пароль
                <input
                  required
                  type="password"
                  name="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={registering ? 8 : 1}
                  maxLength={128}
                  autoComplete={registering ? "new-password" : "current-password"}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            )}
            {recoverySent && recovering && (
              <p
                role="status"
                className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              >
                Если аккаунт с таким адресом существует, письмо с инструкциями уже отправлено.
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-rose-600">
                {error}
              </p>
            )}
            <button
              disabled={busy}
              className="mt-1 min-h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {busy
                ? "Подождите…"
                : recovering
                  ? "Отправить ссылку"
                  : registering
                    ? "Зарегистрироваться"
                    : "Войти"}
            </button>
          </form>
          {!registering && !recovering && (
            <div className="mt-4 grid gap-3">
              <VkIdLogin onError={setError} onToken={authenticateWithVk} />
              <YandexIdLogin
                busy={busy}
                onError={setError}
                onToken={(accessToken) => void authenticateWithYandex(accessToken)}
              />
              {pendingVkToken && (
                <button
                  type="button"
                  disabled={busy || !password}
                  onClick={() => void authenticateWithVk(pendingVkToken, password)}
                  className="min-h-11 rounded-xl border border-blue-300 px-4 text-sm font-semibold text-blue-700 disabled:opacity-50 dark:border-blue-900 dark:text-blue-300"
                >
                  Подтвердить привязку VK ID
                </button>
              )}
              {pendingYandexToken && (
                <button
                  type="button"
                  disabled={busy || !password}
                  onClick={() => void authenticateWithYandex(pendingYandexToken, password)}
                  className="min-h-11 rounded-xl border border-red-300 px-4 text-sm font-semibold text-red-700 disabled:opacity-50 dark:border-red-900 dark:text-red-300"
                >
                  Подтвердить привязку существующего аккаунта
                </button>
              )}
            </div>
          )}
          {recovering ? (
            <button
              type="button"
              onClick={() => {
                setRecovering(false);
                setRecoverySent(false);
                setError("");
              }}
              className="mt-5 w-full text-sm text-slate-600 hover:text-blue-700 dark:text-slate-300"
            >
              Вернуться ко входу
            </button>
          ) : (
            <>
              <button
                onClick={() => {
                  setRegistering((value) => !value);
                  setError("");
                }}
                className="mt-5 w-full text-sm text-slate-600 hover:text-blue-700 dark:text-slate-300"
              >
                {registering ? "Уже есть аккаунт? Войти" : "Нет аккаунта? Зарегистрироваться"}
              </button>
              {!registering && (
                <button
                  type="button"
                  onClick={() => {
                    setRecovering(true);
                    setRecoverySent(false);
                    setError("");
                  }}
                  className="mt-3 w-full text-sm font-medium text-blue-700 hover:text-blue-800 dark:text-blue-300"
                >
                  Забыли пароль?
                </button>
              )}
            </>
          )}
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-12 text-white lg:flex lg:flex-col lg:justify-end">
        <div className="absolute -top-24 -right-20 size-96 rounded-full border border-white/15" />
        <div className="absolute -top-12 -right-8 size-72 rounded-full border border-white/15" />
        <p className="text-sm font-semibold text-blue-100">РЕМОНТ ТЕХНИКИ — ПРОСТО</p>
        <h2 className="mt-3 max-w-lg text-4xl leading-tight font-semibold">
          Заявки, мастера и история ремонта — под рукой.
        </h2>
        <p className="mt-4 max-w-md text-sm leading-6 text-blue-100">
          Создавайте обращения и следите за их статусом в личном кабинете.
        </p>
      </aside>
    </main>
  );
};

export const Route = createFileRoute("/login")({ component: LoginPage });
