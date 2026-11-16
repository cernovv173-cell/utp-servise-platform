import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LogOut, Phone } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import { updateProfile } from "@/lib/api";
import { getPhoneNumberError, phoneNumberPlaceholder } from "@/lib/phone";

const inputClassName =
  "h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900";

export const CustomerPhoneGate = () => {
  const { token, logout } = useAuth();
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => updateProfile(token!, phone.trim()),
    onSuccess: ({ user }) => {
      queryClient.setQueryData(["auth", "me", token], { user });
      toast.success("Телефон сохранён");
    },
    onError: (failure) => {
      const message =
        failure instanceof Error
          ? failure.message
          : "Не удалось сохранить номер. Попробуйте ещё раз.";
      setError(message);
      toast.error(message);
    },
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const phoneError = getPhoneNumberError(phone, { required: true });
    setError(phoneError);
    if (!phoneError) {
      mutation.mutate();
    }
  };

  return (
    <section className="mx-auto grid max-w-md gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <div className="grid gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
          <Phone size={20} />
        </span>
        <div>
          <h2 className="text-xl font-semibold">Укажите номер телефона</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Номер нужен, чтобы мастер и администратор могли связаться с вами по заказу. Пока номер
            не указан, личный кабинет недоступен.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-4">
        <label className="grid gap-1.5 text-sm font-medium">
          Телефон
          <input
            required
            type="tel"
            name="phone"
            inputMode="tel"
            autoComplete="tel"
            maxLength={32}
            placeholder={phoneNumberPlaceholder}
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            className={inputClassName}
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="h-11 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? "Сохраняем…" : "Сохранить и продолжить"}
        </button>
      </form>
      <button
        type="button"
        onClick={logout}
        className="inline-flex items-center justify-center gap-2 text-sm font-medium text-slate-500 transition hover:text-slate-900 dark:hover:text-white"
      >
        <LogOut size={16} />
        Выйти из аккаунта
      </button>
    </section>
  );
};
