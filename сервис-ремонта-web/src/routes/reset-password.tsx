import { Link, createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";

import { BrandLogo } from "@/components/brand-logo";

import { createPublicAuthHref } from "@/features/auth/public-auth-entry";

import { confirmPasswordReset, confirmPasswordResetWithCode } from "@/lib/api";
import { createPageHead } from "@/lib/seo";

const ResetPasswordPage = () => {
  const [token] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.hash.slice(1)).get("token") ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (window.location.hash) {
      window.history.replaceState(
        window.history.state,
        "",
        `${window.location.pathname}${window.location.search}`,
      );
    }
  }, []);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const password = String(values.get("password"));
    if (password !== String(values.get("confirmPassword"))) {
      setError("Пароли не совпадают.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      if (token) {
        await confirmPasswordReset(token, password);
      } else {
        await confirmPasswordResetWithCode(
          String(values.get("identifier")).trim(),
          String(values.get("code")).trim(),
          password,
        );
      }
      setDone(true);
      toast.success("Пароль изменён. Теперь войдите с новым паролем.");
    } catch (failure) {
      const message = failure instanceof Error ? failure.message : "Не удалось изменить пароль.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 px-5 py-10 dark:bg-slate-950">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Link to="/" className="flex items-center gap-3 text-lg font-bold">
          <BrandLogo className="size-10 rounded-xl border border-slate-200" />
          ЕНОТ СЕРВИС
        </Link>
        <h1 className="mt-8 text-2xl font-semibold">Восстановление пароля</h1>
        {done ? (
          <div className="mt-4 grid gap-4">
            <p role="status" className="text-sm leading-6 text-emerald-700 dark:text-emerald-300">
              Пароль изменён. Теперь войдите с новым паролем.
            </p>
            <a
              href={createPublicAuthHref("login")}
              className="min-h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
            >
              Перейти ко входу
            </a>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {token
                ? "Старая ссылка действует 30 минут и используется один раз."
                : "Введите почту или логин аккаунта и шестизначный код из письма или МАКС. Код действует 30 минут; после пяти неверных попыток запросите новый."}{" "}
              Придумайте пароль длиной не менее 8 символов.
            </p>
            <form onSubmit={submit} className="mt-6 grid gap-4">
              {!token && (
                <>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Электронная почта или логин
                    <input
                      required
                      type="text"
                      name="identifier"
                      maxLength={320}
                      autoComplete="username"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium">
                    Код из сообщения
                    <input
                      required
                      type="text"
                      name="code"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      minLength={6}
                      maxLength={6}
                      aria-describedby="reset-code-help"
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal tracking-[0.3em] outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                    />
                    <span id="reset-code-help" className="text-xs font-normal text-slate-500">
                      Код отправлен на привязанные к аккаунту каналы связи.
                    </span>
                  </label>
                </>
              )}
              <label className="grid gap-1.5 text-sm font-medium">
                Новый пароль
                <input
                  required
                  type="password"
                  name="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                Повторите пароль
                <input
                  required
                  type="password"
                  name="confirmPassword"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              {error && (
                <p role="alert" className="text-sm text-rose-600">
                  {error}
                </p>
              )}
              <button
                disabled={busy}
                className="min-h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? "Сохранение…" : "Сохранить новый пароль"}
              </button>
            </form>
          </>
        )}
      </section>
    </main>
  );
};

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () =>
    createPageHead({
      title: "Восстановление пароля — ЕНОТ СЕРВИС",
      description: "Восстановление доступа к личному кабинету сервиса ЕНОТ СЕРВИС.",
      path: "/reset-password",
      noindex: true,
    }),
});
