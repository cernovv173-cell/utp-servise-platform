import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { confirmMaxEmailLogin, requestMaxEmailLoginCode } from "@/lib/api";

export const MaxEmailLoginCard = ({ token }: { token: string }) => {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const requestCode = useMutation({
    mutationFn: () => requestMaxEmailLoginCode(token, email.trim()),
    onSuccess: () => {
      setCodeRequested(true);
      toast.success("Код отправлен на почту");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отправить код."),
  });
  const confirmEmail = useMutation({
    mutationFn: () => confirmMaxEmailLogin(token, email.trim(), code.trim(), password),
    onSuccess: async ({ user }) => {
      queryClient.setQueryData(["auth", "me", token], { user });
      await queryClient.invalidateQueries({ queryKey: ["auth", "me"] });
      toast.success("Почта подтверждена. Теперь можно входить по почте и паролю.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось подтвердить почту."),
  });

  const submitRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    requestCode.mutate();
  };

  const submitConfirmation = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim().length !== 6) {
      toast.error("Введите шестизначный код из письма.");
      return;
    }
    if (password.length < 8) {
      toast.error("Пароль должен содержать не менее 8 символов.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Пароли не совпадают.");
      return;
    }
    confirmEmail.mutate();
  };

  return (
    <SectionCard>
      <h2 className="font-semibold">Резервный вход по почте</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">
        Подтвердите адрес и задайте пароль. После этого сможете входить и через MAX, и по почте с
        паролем.
      </p>
      {!codeRequested ? (
        <form onSubmit={submitRequest} className="mt-4 grid justify-items-start gap-3">
          <label className="grid w-full gap-1.5 text-sm font-medium">
            Электронная почта
            <input
              type="email"
              autoComplete="email"
              required
              maxLength={320}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <button
            type="submit"
            disabled={requestCode.isPending}
            className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
          >
            {requestCode.isPending ? "Отправляем код…" : "Отправить код"}
          </button>
        </form>
      ) : (
        <form onSubmit={submitConfirmation} className="mt-4 grid gap-3">
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            Код отправлен на {email.trim()}. Он действует 10 минут.
          </p>
          <label className="grid gap-1.5 text-sm font-medium">
            Код из письма
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              required
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/gu, "").slice(0, 6))}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal tracking-widest dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Пароль для входа по почте (не менее 8 символов)
            <input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              maxLength={128}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Повторите пароль
            <input
              type="password"
              autoComplete="new-password"
              required
              maxLength={128}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={confirmEmail.isPending}
              className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {confirmEmail.isPending ? "Подтверждаем…" : "Подтвердить и сохранить"}
            </button>
            <button
              type="button"
              disabled={requestCode.isPending}
              onClick={() => requestCode.mutate()}
              className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Отправить код повторно
            </button>
          </div>
        </form>
      )}
    </SectionCard>
  );
};
