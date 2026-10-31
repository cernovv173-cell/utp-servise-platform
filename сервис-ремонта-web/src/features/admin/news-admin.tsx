import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import { createNews, deleteNews, getNews, updateNews } from "@/lib/api";
import { useCurrentTime } from "@/lib/current-time";

export const NewsAdmin = () => {
  const { token } = useAuth();
  const now = useCurrentTime();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["news", token],
    queryFn: ({ signal }) => getNews(token!, signal),
    enabled: Boolean(token),
  });
  const save = useMutation({
    mutationFn: (input: Parameters<typeof createNews>[1]) => createNews(token!, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["news", token] }),
  });
  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { isPublished?: boolean; isFeatured?: boolean };
    }) => updateNews(token!, id, data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["news", token] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteNews(token!, id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["news", token] }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    const startsAt = String(form.get("startsAt") || "");
    const endsAt = String(form.get("endsAt") || "");
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      setError("Дата окончания должна быть позже даты начала.");
      return;
    }
    save.mutate(
      {
        title: String(form.get("title")),
        content: String(form.get("content")),
        isPublished: form.get("isPublished") === "on",
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isFeatured: form.get("isFeatured") === "on",
      },
      { onSuccess: () => formElement.reset() },
    );
  };
  return (
    <div className="grid gap-5">
      <SectionCard>
        <h2 className="font-semibold">Новая новость или акция</h2>
        <p className="mt-1 text-sm text-slate-500">
          Публикация может начаться и закончиться автоматически по расписанию.
        </p>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Заголовок
            <input
              name="title"
              required
              minLength={3}
              maxLength={160}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Текст
            <textarea
              name="content"
              required
              minLength={5}
              maxLength={8000}
              rows={4}
              className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Начало показа
            <input
              type="datetime-local"
              name="startsAt"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-xs text-slate-400">
              Оставьте пустым для немедленного показа после публикации.
            </span>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Окончание показа
            <input
              type="datetime-local"
              name="endsAt"
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-xs text-slate-400">
              После этой даты новость автоматически скроется.
            </span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="isPublished"
              type="checkbox"
              defaultChecked
              className="size-4 accent-blue-600"
            />
            Опубликовать (иначе сохранить черновиком)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input name="isFeatured" type="checkbox" className="size-4 accent-blue-600" />
            Показывать в приоритетном блоке главной
          </label>
          {(error || save.isError) && (
            <p role="alert" className="text-sm text-rose-600 md:col-span-2">
              {error || "Не удалось сохранить новость."}
            </p>
          )}
          <button
            disabled={save.isPending}
            className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {save.isPending ? "Сохраняем…" : "Сохранить новость"}
          </button>
        </form>
      </SectionCard>
      <SectionCard>
        <h2 className="mb-4 font-semibold">Все публикации</h2>
        <div className="grid gap-3">
          {(query.data?.articles ?? []).map((item) => {
            const state = !item.isPublished
              ? "Черновик"
              : item.startsAt && new Date(item.startsAt).getTime() > now
                ? "Запланирована"
                : item.endsAt && new Date(item.endsAt).getTime() <= now
                  ? "Срок истёк"
                  : "Показывается";
            return (
              <article
                key={item.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
              >
                <div>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {state}
                    {item.startsAt ? ` · с ${new Date(item.startsAt).toLocaleString("ru-RU")}` : ""}
                    {item.endsAt ? ` · до ${new Date(item.endsAt).toLocaleString("ru-RU")}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      update.mutate({ id: item.id, data: { isFeatured: !item.isFeatured } })
                    }
                    aria-label={
                      item.isFeatured
                        ? `Убрать с главной: ${item.title}`
                        : `Показать на главной: ${item.title}`
                    }
                    title={item.isFeatured ? "Убрать с главной" : "На главную"}
                    className={`rounded-lg border px-3 py-2 text-xs font-medium ${item.isFeatured ? "border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950" : "border-slate-200 dark:border-slate-700"}`}
                  >
                    {item.isFeatured ? "На главной" : "На главную"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      update.mutate({ id: item.id, data: { isPublished: !item.isPublished } })
                    }
                    aria-label={
                      item.isPublished ? `Скрыть: ${item.title}` : `Опубликовать: ${item.title}`
                    }
                    title={item.isPublished ? "Скрыть" : "Опубликовать"}
                    className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    {item.isPublished ? (
                      <Lock size={16} aria-hidden="true" />
                    ) : (
                      <Unlock size={16} aria-hidden="true" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label={`Удалить публикацию «${item.title}»`}
                    title="Удалить публикацию"
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`Удалить публикацию «${item.title}»?`)) {
                        remove.mutate(item.id);
                      }
                    }}
                    className="grid size-9 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
          {query.isLoading && <p className="text-sm text-slate-500">Загружаем…</p>}
        </div>
      </SectionCard>
    </div>
  );
};
