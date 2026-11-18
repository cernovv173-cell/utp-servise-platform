import { useMutation } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { useAuth } from "@/features/auth/auth-context";

import { type CustomerFeedbackType, submitCustomerFeedback } from "@/lib/api";

const typeOptions: Array<{ value: CustomerFeedbackType; label: string }> = [
  { value: "COMPLAINT", label: "Жалоба" },
  { value: "SUGGESTION", label: "Предложение" },
];

export const CustomerFeedbackForm = () => {
  const { token } = useAuth();
  const [type, setType] = useState<CustomerFeedbackType>("SUGGESTION");
  const [content, setContent] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const submit = useMutation({
    mutationFn: () => submitCustomerFeedback(token!, type, content.trim()),
    onSuccess: () => {
      setContent("");
      setSubmitted(true);
      toast.success("Сообщение отправлено администраторам.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отправить сообщение."),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = content.trim();
    if (!message || submit.isPending) return;
    setSubmitted(false);
    submit.mutate();
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900">
      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">
        Напишите, что стоит улучшить или на что обратить внимание. Сообщение увидят только
        администраторы сервиса.
      </p>
      <form className="mt-5 grid gap-4" onSubmit={handleSubmit}>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Тип обращения</legend>
          <div className="flex flex-wrap gap-2">
            {typeOptions.map((option) => {
              const selected = type === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setType(option.value)}
                  className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${
                    selected
                      ? "bg-blue-600 text-white"
                      : "border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div>
          <label htmlFor="customer-feedback-content" className="mb-2 block text-sm font-medium">
            Сообщение&nbsp;
            <span aria-hidden="true" className="text-rose-600">
              *
            </span>
          </label>
          <textarea
            id="customer-feedback-content"
            required
            maxLength={2000}
            rows={6}
            value={content}
            onChange={(event) => setContent(event.currentTarget.value)}
            placeholder="Опишите ситуацию или вашу идею…"
            className="min-h-36 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm transition outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950"
          />
          <p className="mt-1 text-right text-xs text-slate-500">{content.length}/2000</p>
        </div>
        <button
          type="submit"
          disabled={!token || !content.trim() || submit.isPending}
          className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submit.isPending ? "Отправляем…" : "Отправить"}
        </button>
      </form>
      {submitted && (
        <p
          role="status"
          className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        >
          Спасибо! Сообщение передано администраторам.
        </p>
      )}
    </section>
  );
};
