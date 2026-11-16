import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, Upload, X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";
import { ProtectedMedia } from "@/components/protected-media";

import { NewsArticleEditDialog } from "@/features/admin/news-article-edit-dialog";
import { useAuth } from "@/features/auth/auth-context";

import {
  type NewsArticle,
  type NewsArticleKind,
  createNews,
  deleteNews,
  getNews,
  updateNews,
  uploadAdminMedia,
} from "@/lib/api";
import { useCurrentTime } from "@/lib/current-time";

export const NewsAdmin = () => {
  const { token } = useAuth();
  const now = useCurrentTime();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const [kind, setKind] = useState<NewsArticleKind>("NEWS");
  const [editingArticle, setEditingArticle] = useState<NewsArticle | null>(null);
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
    mutationFn: ({ id, data }: { id: string; data: Partial<NewsArticle> }) =>
      updateNews(token!, id, data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["news", token] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteNews(token!, id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["news", token] }),
  });
  const uploadMedia = useMutation({
    mutationFn: ({ id, file, kind }: { id: string; file: File; kind: NewsArticleKind }) =>
      uploadAdminMedia(
        kind === "WORK_STORY" ? `/news/${id}/image` : `/news/${id}/media`,
        token!,
        file,
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["news", token] }),
    onError: () => {
      const message = "Не удалось загрузить фото или видео. Выберите изображение или MP4 до 20 МБ.";
      setError(message);
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const formElement = event.currentTarget;
    const startsAt = String(form.get("startsAt") || "");
    const endsAt = String(form.get("endsAt") || "");
    const media = form.get("media");
    const selectedMedia = media instanceof File && media.size ? media : null;
    const publishAfterUpload = form.get("isPublished") === "on";
    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
      setError("Дата окончания должна быть позже даты начала.");
      return;
    }
    save.mutate(
      {
        title: String(form.get("title")),
        content: String(form.get("content")),
        kind,
        isPublished: selectedMedia ? false : publishAfterUpload,
        startsAt: startsAt ? new Date(startsAt).toISOString() : null,
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        isFeatured: form.get("isFeatured") === "on",
      },
      {
        onSuccess: async ({ article }) => {
          if (selectedMedia) {
            try {
              await uploadMedia.mutateAsync({ id: article.id, file: selectedMedia, kind });
              if (publishAfterUpload) {
                await updateNews(token!, article.id, { isPublished: true });
              }
            } catch {
              const message =
                "Черновик сохранён, но медиа не загрузилось. Добавьте файл к публикации ниже.";
              setError(message);
              toast.warning(message);
              await client.invalidateQueries({ queryKey: ["news", token] });
              return;
            }
          }
          formElement.reset();
          setKind("NEWS");
          toast.success("Публикация сохранена.");
          await client.invalidateQueries({ queryKey: ["news", token] });
        },
      },
    );
  };
  return (
    <div className="grid gap-5">
      <SectionCard>
        <h2 className="font-semibold">Новая публикация</h2>
        <p className="mt-1 text-sm text-slate-500">
          Истории работ публикуются отдельно от отзывов клиентов и не отправляются как новостное
          уведомление.
        </p>
        <form onSubmit={submit} className="mt-5 grid gap-4 md:grid-cols-2">
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="text-sm font-medium">Тип публикации</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {[
                {
                  value: "NEWS" as const,
                  title: "Новость или акция",
                  note: "Объявления и обновления сервиса",
                },
                {
                  value: "WORK_STORY" as const,
                  title: "Пример работы",
                  note: "История от сервиса, не отзыв клиента",
                },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${kind === option.value ? "border-blue-500 bg-blue-50/70 dark:border-cyan-500 dark:bg-cyan-950/30" : "border-slate-200 dark:border-slate-700"}`}
                >
                  <input
                    type="radio"
                    name="kind"
                    value={option.value}
                    checked={kind === option.value}
                    onChange={() => setKind(option.value)}
                    className="mt-1 size-4 accent-blue-600"
                  />
                  <span>
                    <span className="block text-sm font-semibold">{option.title}</span>
                    <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                      {option.note}
                    </span>
                  </span>
                </label>
              ))}
            </div>
            {kind === "WORK_STORY" && (
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                Опишите проблему, выполненную работу и результат. Не добавляйте личные данные
                клиента без его согласия.
              </p>
            )}
          </fieldset>
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
            {kind === "WORK_STORY" ? "Описание примера работы" : "Текст"}
            <textarea
              name="content"
              required
              minLength={5}
              maxLength={8000}
              rows={4}
              placeholder={
                kind === "WORK_STORY" ? "Проблема: …\nЧто сделали: …\nРезультат: …" : undefined
              }
              className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            {kind === "WORK_STORY"
              ? "Фото работы (необязательно)"
              : "Фото или видео (необязательно)"}
            <input
              name="media"
              type="file"
              accept={
                kind === "WORK_STORY"
                  ? "image/jpeg,image/png,image/webp"
                  : "image/jpeg,image/png,image/webp,video/mp4"
              }
              className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal dark:border-slate-700 dark:bg-slate-950"
            />
            <span className="text-xs font-normal text-slate-500">
              {kind === "WORK_STORY"
                ? "Можно добавить реальное фото выполненной работы (до 5 МБ)."
                : "Фото до 5 МБ или видео MP4 до 20 МБ."}
            </span>
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
            disabled={save.isPending || uploadMedia.isPending}
            className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {save.isPending
              ? "Сохраняем…"
              : kind === "WORK_STORY"
                ? "Сохранить пример работы"
                : "Сохранить новость"}
          </button>
        </form>
      </SectionCard>
      <SectionCard>
        <h2 className="mb-4 font-semibold">Новости и примеры работ</h2>
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
                {(item.imageObjectId || item.videoObjectId) && (
                  <ProtectedMedia
                    objectId={item.videoObjectId || item.imageObjectId}
                    alt={item.title}
                    className="mb-3 max-h-56 w-full rounded-lg object-contain"
                  />
                )}
                <div>
                  <p className="text-xs font-semibold text-blue-700 dark:text-cyan-300">
                    {item.kind === "WORK_STORY" ? "Пример работы от сервиса" : "Новость или акция"}
                  </p>
                  <h3 className="text-sm font-semibold">{item.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">
                    {state}
                    {item.startsAt ? ` · с ${new Date(item.startsAt).toLocaleString("ru-RU")}` : ""}
                    {item.endsAt ? ` · до ${new Date(item.endsAt).toLocaleString("ru-RU")}` : ""}
                  </p>
                </div>
                <div className="flex gap-2">
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700">
                    <Upload size={14} aria-hidden="true" />
                    {item.kind === "WORK_STORY" ? "Фото" : "Медиа"}
                    <input
                      type="file"
                      accept={
                        item.kind === "WORK_STORY"
                          ? "image/jpeg,image/png,image/webp"
                          : "image/jpeg,image/png,image/webp,video/mp4"
                      }
                      className="sr-only"
                      disabled={uploadMedia.isPending}
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        if (file) uploadMedia.mutate({ id: item.id, file, kind: item.kind });
                        event.currentTarget.value = "";
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditingArticle(item)}
                    className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700"
                  >
                    Изменить
                  </button>
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
                    {item.isFeatured ? "Убрать с главной" : "На главную"}
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
      {editingArticle && token && (
        <NewsArticleEditDialog
          article={editingArticle}
          token={token}
          onClose={() => setEditingArticle(null)}
        />
      )}
    </div>
  );
};
