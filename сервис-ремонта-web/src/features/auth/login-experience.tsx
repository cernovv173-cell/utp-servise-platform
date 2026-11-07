import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, ClipboardList, MessageCircle, Wrench } from "lucide-react";
import { type FormEvent, useState } from "react";

import { AppInstallButton } from "@/components/app-install-button";

import { useAuth } from "@/features/auth/auth-context";
import { MaxLogin } from "@/features/auth/max-login";

import {
  type AuthResponse,
  type Role,
  loginRequest,
  registerRequest,
  requestPasswordReset,
} from "@/lib/api";
import { getPhoneNumberError, phoneNumberPlaceholder } from "@/lib/phone";

export type LoginExperienceProps = {
  readonly mode?: "page" | "dialog";
  readonly initialRegister?: boolean;
  readonly nextPath?: string | null;
  readonly onClose?: () => void;
};

export const LoginExperience = ({
  mode = "page",
  initialRegister = false,
  nextPath: suppliedNextPath,
  onClose,
}: LoginExperienceProps) => {
  const isDialog = mode === "dialog";
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const referralFromLink =
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase() ?? "");
  const queryParams =
    typeof window === "undefined"
      ? new URLSearchParams()
      : new URLSearchParams(window.location.search);
  const nextPath = suppliedNextPath ?? queryParams.get("next");
  const safeNextPath = nextPath?.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
  const [registering, setRegistering] = useState(
    Boolean(referralFromLink) || initialRegister || queryParams.get("register") === "1",
  );
  const [referralCode, setReferralCode] = useState(referralFromLink);
  const [recovering, setRecovering] = useState(false);
  const [recoverySent, setRecoverySent] = useState(false);
  const [role, setRole] = useState<Role>("CUSTOMER");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [registeredName, setRegisteredName] = useState<string | null>(null);
  const [joinedWithReferral, setJoinedWithReferral] = useState(false);

  const completeMaxLogin = (session: AuthResponse) => {
    setSession(session);
    if (session.user.mustChangePassword) {
      if (isDialog) onClose?.();
      void navigate({ to: "/account" });
      return;
    }
    if (session.accountCreated) {
      if (isDialog) {
        onClose?.();
        void navigate({ to: safeNextPath });
        return;
      }
      setJoinedWithReferral(Boolean(session.referralApplied));
      setRegisteredName(session.user.displayName);
      return;
    }
    if (isDialog) onClose?.();
    void navigate({ to: safeNextPath });
  };

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
      const enteredReferralCode = String(values.get("referralCode") ?? "").trim();
      const enteredPhone = String(values.get("phone") ?? "").trim();
      if (registering) {
        const phoneError = getPhoneNumberError(enteredPhone, { required: true });
        if (phoneError) {
          setError(phoneError);
          return;
        }
      }
      const session = registering
        ? await registerRequest(
            String(values.get("name")),
            String(values.get("email")),
            enteredPhone,
            String(values.get("password")),
            enteredReferralCode,
          )
        : await loginRequest(String(values.get("email")), String(values.get("password")), role);
      if (registering) {
        setSession(session);
        if (isDialog) {
          onClose?.();
          await navigate({ to: safeNextPath });
          return;
        }
        setJoinedWithReferral(Boolean(enteredReferralCode));
        setRegisteredName(session.user.displayName);
        return;
      }
      setSession(session);
      if (isDialog) onClose?.();
      await navigate({ to: session.user.mustChangePassword ? "/account" : safeNextPath });
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Не удалось выполнить вход.");
    } finally {
      setBusy(false);
    }
  };

  if (registeredName) {
    return (
      <main className="grid min-h-dvh bg-slate-50/35 lg:grid-cols-2 dark:bg-slate-950/35">
        <section className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-lg">
            <Link to="/" className="flex items-center gap-3 text-lg font-bold">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white">
                <Wrench size={20} />
              </span>
              ЕНОТ СЕРВИС
            </Link>
            <div className="mt-12 grid size-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <CheckCircle2 size={30} />
            </div>
            <p className="mt-6 text-sm font-semibold tracking-wide text-blue-700 uppercase dark:text-blue-300">
              Аккаунт создан
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Добро пожаловать, {registeredName}!
            </h1>
            <p className="mt-4 max-w-md text-base leading-7 text-slate-600 dark:text-slate-300">
              Теперь можно оформить заявку на ремонт, следить за её статусом и общаться с сервисом в
              одном месте.
            </p>
            {joinedWithReferral && (
              <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                Вас пригласил друг. После завершения первого ремонта и подтверждения оплаты сервисом
                вам начислят 250 бонусных баллов, и пригласивший тоже получит 250 баллов. Это баллы
                для скидки, а не деньги для вывода.
              </p>
            )}
            <div className="mt-8 grid gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <ClipboardList size={20} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-semibold">Создайте заявку</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Укажите устройство и опишите, что нужно проверить или починить.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <MessageCircle size={20} className="mt-0.5 shrink-0 text-blue-600" />
                <div>
                  <p className="font-semibold">Оставайтесь на связи</p>
                  <p className="mt-1 text-sm leading-6 text-slate-500">
                    Следите за ходом ремонта и задавайте вопросы в чате заявки.
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              {safeNextPath === "/shop" ? (
                <Link
                  to="/shop"
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
                >
                  Перейти в магазин <ArrowRight size={18} />
                </Link>
              ) : (
                <Link
                  to="/orders"
                  className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
                >
                  Создать заявку <ArrowRight size={18} />
                </Link>
              )}
              <Link
                to="/"
                className="inline-flex min-h-12 items-center rounded-xl border border-slate-200 px-5 font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
              >
                В личный кабинет
              </Link>
            </div>
          </div>
        </section>
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-cyan-500 p-12 text-white lg:flex lg:flex-col lg:justify-end">
          <div className="absolute -top-24 -right-20 size-96 rounded-full border border-white/15" />
          <div className="absolute -top-12 -right-8 size-72 rounded-full border border-white/15" />
          <p className="text-sm font-semibold text-blue-100">ЕНОТ СЕРВИС — РЯДОМ</p>
          <h2 className="mt-3 max-w-lg text-4xl leading-tight font-semibold">
            Ремонт техники — с понятными шагами.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-blue-100">
            Заявка, сообщения и история ремонта будут доступны в вашем аккаунте.
          </p>
        </aside>
      </main>
    );
  }

  return (
    <main
      className={
        isDialog ? "" : "grid min-h-dvh bg-slate-50/35 lg:grid-cols-2 dark:bg-slate-950/35"
      }
    >
      <section className={isDialog ? "" : "flex items-center justify-center px-5 py-10"}>
        <div className="w-full max-w-md">
          {isDialog ? (
            <div className="flex items-center gap-3 text-lg font-bold">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white">
                <Wrench size={20} aria-hidden="true" />
              </span>
              ЕНОТ СЕРВИС
            </div>
          ) : (
            <Link to="/" className="flex items-center gap-3 text-lg font-bold">
              <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white">
                <Wrench size={20} aria-hidden="true" />
              </span>
              ЕНОТ СЕРВИС
            </Link>
          )}
          <h1 className={`${isDialog ? "mt-5" : "mt-10"} text-3xl font-semibold`}>
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
          {!isDialog && (
            <div className="mt-4">
              <AppInstallButton />
            </div>
          )}
          {!recovering && (registering || role === "CUSTOMER") && (
            <div className="mt-6">
              <MaxLogin
                referralCode={referralCode}
                disabled={busy}
                onError={() => setError("")}
                onSuccess={completeMaxLogin}
              />
              <div className="my-6 flex items-center gap-3 text-xs font-semibold tracking-wide text-slate-400 uppercase">
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
                {registering ? "или по почте" : "или по почте/логину"}
                <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
              </div>
            </div>
          )}
          <form
            onSubmit={submit}
            className={`${!recovering && (registering || role === "CUSTOMER") ? "" : "mt-8"} grid gap-4`}
          >
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
              {registering || recovering ? "Электронная почта" : "Электронная почта или логин"}
              <input
                required
                type={registering || recovering ? "email" : "text"}
                name="email"
                autoComplete={registering || recovering ? "email" : "username"}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            {registering && !recovering && (
              <label className="grid gap-1.5 text-sm font-medium">
                Телефон
                <input
                  required
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  inputMode="tel"
                  maxLength={32}
                  placeholder={phoneNumberPlaceholder}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            )}
            {registering && !recovering && (
              <label className="grid gap-1.5 text-sm font-medium">
                Код приглашения, если есть
                <input
                  name="referralCode"
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                  maxLength={16}
                  autoCapitalize="characters"
                  autoComplete="off"
                  aria-describedby="referral-help"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal uppercase outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
                />
                <span id="referral-help" className="text-xs leading-5 text-slate-500">
                  Если вы пришли по ссылке, код уже заполнен. После завершения первого ремонта и
                  подтверждения оплаты сервисом вы и ваш друг получите по 250 бонусных баллов.
                </span>
              </label>
            )}
            {!registering && !recovering && (
              <fieldset className="grid gap-2">
                <legend className="mb-1 text-sm font-medium">Войти как</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ["CUSTOMER", "Клиент"],
                      ["TECHNICIAN", "Мастер"],
                      ["PROCUREMENT", "Мастер закупки"],
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
              <div
                role="status"
                className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
              >
                <p>
                  Если аккаунт с таким адресом существует, код отправлен на почту и в привязанный
                  MAX.
                </p>
                <Link
                  to="/reset-password"
                  className="mt-2 inline-flex font-semibold underline underline-offset-4"
                >
                  Перейти к вводу кода
                </Link>
              </div>
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
                  ? "Отправить код"
                  : registering
                    ? "Зарегистрироваться"
                    : "Войти"}
            </button>
          </form>
          {!registering && !recovering && (
            <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
              Аккаунт, созданный через МАКС, не имеет почты — входите через бота выше.
            </p>
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
          <a
            href="/privacy-policy.html"
            className="mt-5 block text-center text-xs text-slate-500 underline underline-offset-4 hover:text-blue-700 dark:text-slate-400 dark:hover:text-cyan-300"
          >
            Политика конфиденциальности
          </a>
        </div>
      </section>
      {!isDialog && (
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
      )}
    </main>
  );
};
