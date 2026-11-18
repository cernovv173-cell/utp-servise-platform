import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Select } from "@/components/select";

import { useAuth } from "@/features/auth/auth-context";

import {
  type CustomerFeedback,
  type CustomerFeedbackStatus,
  type CustomerFeedbackType,
  getAdminCustomerFeedback,
  updateAdminCustomerFeedbackStatus,
} from "@/lib/api";

const statusOptions: Array<{ value: CustomerFeedbackStatus; label: string }> = [
  { value: "NEW", label: "Новое" },
  { value: "IN_PROGRESS", label: "В работе" },
  { value: "RESOLVED", label: "Решено" },
];

const feedbackTypeLabel: Record<CustomerFeedbackType, string> = {
  COMPLAINT: "Жалоба",
  SUGGESTION: "Предложение",
};

const updateStatus = (token: string, feedbackId: string, value: string) =>
  updateAdminCustomerFeedbackStatus(token, feedbackId, value as CustomerFeedbackStatus);

export const AdminFeedbackInbox = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const feedback = useQuery({
    queryKey: ["admin-customer-feedback", token],
    queryFn: ({ signal }) => getAdminCustomerFeedback(token!, signal),
    enabled: Boolean(token),
    refetchInterval: 10_000,
  });
  const status = useMutation({
    mutationFn: ({ id, value }: { id: string; value: string }) => updateStatus(token!, id, value),
    onSuccess: async () => {
      toast.success("Статус обращения обновлён.");
      await queryClient.invalidateQueries({ queryKey: ["admin-customer-feedback", token] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить статус."),
  });
  const entries = feedback.data?.feedback ?? [];

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-700 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Входящие сообщения</h2>
          <p className="mt-1 text-sm text-slate-500">
            Всего: {entries.length} · новых:{" "}
            {entries.filter((entry) => entry.status === "NEW").length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void feedback.refetch()}
          disabled={feedback.isFetching}
          className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700"
        >
          Обновить
        </button>
      </div>
      {feedback.isLoading && <p className="mt-4 text-sm text-slate-500">Загружаем обращения…</p>}
      {feedback.isError && (
        <p role="alert" className="mt-4 text-sm text-rose-600">
          Не удалось загрузить жалобы и предложения. Повторите попытку.
        </p>
      )}
      {!feedback.isLoading && !feedback.isError && entries.length === 0 && (
        <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950/60">
          Обращений пока нет.
        </p>
      )}
      <div className="mt-4 grid gap-3">
        {entries.map((entry: CustomerFeedback) => (
          <article
            key={entry.id}
            className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{entry.customer.displayName}</h3>
                  <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-950/50 dark:text-blue-200">
                    {feedbackTypeLabel[entry.type]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.customer.email || entry.customer.phoneNumber || "Клиент"} ·{" "}
                  {new Date(entry.createdAt).toLocaleString("ru-RU")}
                </p>
              </div>
              <div className="w-full max-w-44">
                <Select
                  ariaLabel={`Статус обращения от ${entry.customer.displayName}`}
                  value={entry.status}
                  options={statusOptions}
                  disabled={status.isPending}
                  onValueChange={(value) => status.mutate({ id: entry.id, value })}
                  className="dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                  contentClassName="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
            <p className="mt-4 text-sm leading-6 break-words whitespace-pre-wrap text-slate-700 dark:text-slate-200">
              {entry.content}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
};
