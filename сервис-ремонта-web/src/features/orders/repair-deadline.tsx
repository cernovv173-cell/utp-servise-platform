import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { type RepairOrder, setExpectedCompletion } from "@/lib/api";

const localDateTime = (value: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
};

const formatDeadline = (value: string | null) =>
  value ? new Date(value).toLocaleString("ru-RU") : "срок снят";

export const RepairDeadlineHistory = ({ order }: { order: RepairOrder }) => (
  <section className="mt-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <h4 className="text-xs font-semibold">Плановая готовность</h4>
    <p className="mt-1 text-sm">
      {order.expectedCompletionAt
        ? new Date(order.expectedCompletionAt).toLocaleString("ru-RU")
        : "Срок пока не указан"}
    </p>
    <h5 className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
      История переноса срока
    </h5>
    {order.deadlineChanges?.length ? (
      <ol className="mt-2 grid gap-2">
        {order.deadlineChanges.map((change) => (
          <li key={change.id} className="border-l-2 border-blue-500 pl-3 text-xs">
            <p>
              {formatDeadline(change.previousExpectedAt)} →{" "}
              {formatDeadline(change.expectedCompletionAt)}
            </p>
            <p className="mt-0.5 text-slate-500">
              {change.actor?.displayName ?? "Сотрудник сервиса"} ·{" "}
              {new Date(change.createdAt).toLocaleString("ru-RU")}
            </p>
            {change.note && <p className="mt-1">Пояснение: {change.note}</p>}
          </li>
        ))}
      </ol>
    ) : (
      <p className="mt-1 text-xs text-slate-500">Переносов срока пока нет.</p>
    )}
  </section>
);

export const RepairDeadlineEditor = ({
  order,
  token,
  onSaved,
}: {
  order: RepairOrder;
  token: string;
  onSaved: () => Promise<unknown> | void;
}) => {
  const [value, setValue] = useState(() => localDateTime(order.expectedCompletionAt));
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const mutation = useMutation({
    mutationFn: () => {
      const expectedCompletionAt = value ? new Date(value).toISOString() : null;
      return setExpectedCompletion(token, order.id, expectedCompletionAt, note.trim() || undefined);
    },
    onSuccess: async ({ order: updated }) => {
      setValue(localDateTime(updated.expectedCompletionAt));
      setNote("");
      setError("");
      await onSaved();
    },
    onError: (cause) => {
      const message = cause instanceof Error ? cause.message : "Не удалось сохранить срок.";
      setError(message);
      toast.error(message);
    },
  });
  const selectedIso = value ? new Date(value).toISOString() : null;
  const currentIso = order.expectedCompletionAt
    ? new Date(order.expectedCompletionAt).toISOString()
    : null;
  const unchanged = selectedIso === currentIso;

  return (
    <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-900 dark:bg-blue-950/20">
      <label className="grid gap-1 text-xs font-semibold">
        Плановая дата готовности
        <input
          type="datetime-local"
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <label className="mt-2 grid gap-1 text-xs font-medium">
        Пояснение клиенту при переносе (необязательно)
        <input
          value={note}
          onChange={(event) => setNote(event.currentTarget.value.slice(0, 500))}
          maxLength={500}
          placeholder="Например: ожидаем поставку детали"
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <button
        type="button"
        disabled={mutation.isPending || unchanged}
        onClick={() => mutation.mutate()}
        className="mt-3 min-h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {mutation.isPending ? "Сохраняем…" : "Сохранить срок и уведомить клиента"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {error}
        </p>
      )}
      <RepairDeadlineHistory order={order} />
    </div>
  );
};
