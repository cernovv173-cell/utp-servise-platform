import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { SectionCard } from "@/components/app-shell";
import { ProtectedMedia } from "@/components/protected-media";

import { useAuth } from "@/features/auth/auth-context";

import { createBanner, deleteBanner, getBanners, updateBanner, uploadAdminMedia } from "@/lib/api";

const iso = (value: string) => (value ? new Date(value).toISOString() : null);

export const BannerManagement = () => {
  const { token } = useAuth();
  const client = useQueryClient();
  const [error, setError] = useState("");
  const query = useQuery({
    queryKey: ["banners", token],
    queryFn: ({ signal }) => getBanners(token!, signal),
  });
  const create = useMutation({
    mutationFn: (input: Parameters<typeof createBanner>[1]) => createBanner(token!, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["banners", token] }),
  });
  const update = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { isActive: boolean } }) =>
      updateBanner(token!, id, data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["banners", token] }),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteBanner(token!, id),
    onSuccess: () => client.invalidateQueries({ queryKey: ["banners", token] }),
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const starts = String(values.get("startsAt") || "");
    const ends = String(values.get("endsAt") || "");
    if (starts && ends && new Date(starts) >= new Date(ends)) {
      setError("Дата окончания должна быть позже даты начала.");
      return;
    }
    const mediaValue = values.get("media");
    const media = mediaValue instanceof File && mediaValue.size ? mediaValue : null;
    const activateAfterUpload = values.get("isActive") === "on";
    if (activateAfterUpload && !media) {
      setError("Для активации выберите фото или видео баннера.");
      return;
    }
    create.mutate(
      {
        title: String(values.get("title")),
        content: String(values.get("content")),
        targetUrl: String(values.get("targetUrl") || "") || null,
        placements: values.getAll("placements").map(String) as NonNullable<
          Parameters<typeof createBanner>[1]["placements"]
        >,
        startsAt: iso(starts),
        endsAt: iso(ends),
        isActive: false,
      },
      {
        onSuccess: async ({ banner }) => {
          if (media) {
            await uploadAdminMedia(`/banners/${banner.id}/media`, token!, media);
            if (activateAfterUpload) await updateBanner(token!, banner.id, { isActive: true });
          }
          form.reset();
          await client.invalidateQueries({ queryKey: ["banners", token] });
        },
      },
    );
  };
  return (
    <SectionCard>
      <h2 className="font-semibold">Рекламные баннеры</h2>
      <p className="mt-1 text-sm text-slate-500">
        Выберите места показа и период. Для включения кампании обязательны фото или видео и ссылка.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Заголовок
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Ссылка (HTTP(S) или app://раздел)
          <input
            name="targetUrl"
            type="text"
            required
            placeholder="https://example.ru или app://news"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          Текст
          <textarea
            name="content"
            required
            minLength={1}
            maxLength={1000}
            rows={2}
            className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Начало показа
          <input
            type="datetime-local"
            name="startsAt"
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <fieldset className="grid gap-2 text-sm md:col-span-2">
          <legend className="font-medium">Места показа</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {[
              ["HOME", "Главная"],
              ["NEWS", "Новости"],
              ["SERVICE", "Услуги"],
              ["CRAFTS", "Изделия"],
              ["ABOUT", "О компании"],
              ["LOYALTY", "Лояльность"],
            ].map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="placements"
                  value={value}
                  defaultChecked={value === "HOME"}
                  className="size-4 accent-blue-600"
                />
                {label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="grid gap-1 text-sm font-medium">
          Окончание показа
          <input
            type="datetime-local"
            name="endsAt"
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Фото или видео
          <input
            name="media"
            type="file"
            accept="image/jpeg,image/png,image/webp,video/mp4"
            className="text-xs"
          />
          <span className="text-xs font-normal text-slate-500">Фото до 5 МБ или MP4 до 20 МБ.</span>
        </label>
        <label className="flex items-center gap-2 self-center text-sm">
          <input type="checkbox" name="isActive" className="size-4 accent-blue-600" />
          Активировать после загрузки медиа
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-600">
            {error}
          </p>
        )}
        {create.isError && (
          <p role="alert" className="text-sm text-rose-600">
            Не удалось сохранить баннер. Проверьте адрес ссылки и изображение.
          </p>
        )}
        {update.isError && (
          <p role="alert" className="text-sm text-rose-600">
            Не удалось изменить состояние кампании. Для активации добавьте изображение и ссылку.
          </p>
        )}
        <button
          disabled={create.isPending}
          className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          Добавить баннер
        </button>
      </form>
      <div className="mt-5 grid gap-3">
        {(query.data?.banners ?? []).map((banner) => (
          <article
            key={banner.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
          >
            <ProtectedMedia
              objectId={banner.videoObjectId || banner.imageObjectId}
              alt={banner.title}
              className="size-16 rounded-lg object-cover"
            />
            <div className="min-w-40 flex-1">
              <h3 className="text-sm font-semibold">{banner.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {banner.startsAt ? new Date(banner.startsAt).toLocaleString("ru-RU") : "Сразу"}
                {banner.endsAt
                  ? ` — ${new Date(banner.endsAt).toLocaleString("ru-RU")}`
                  : " — без даты окончания"}
                <span className="block">Места: {banner.placements.join(", ")}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => update.mutate({ id: banner.id, data: { isActive: !banner.isActive } })}
              aria-label={
                banner.isActive
                  ? `Скрыть баннер ${banner.title}`
                  : `Показать баннер ${banner.title}`
              }
              title={banner.isActive ? "Скрыть" : "Показать"}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-slate-700"
            >
              {banner.isActive ? (
                <Lock size={16} aria-hidden="true" />
              ) : (
                <Unlock size={16} aria-hidden="true" />
              )}
            </button>
            <button
              type="button"
              aria-label={`Удалить баннер «${banner.title}»`}
              title="Удалить рекламный баннер"
              disabled={remove.isPending}
              onClick={() => {
                if (window.confirm(`Удалить рекламный баннер «${banner.title}»?`)) {
                  remove.mutate(banner.id);
                }
              }}
              className="grid size-9 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </article>
        ))}
        {query.isLoading && <p className="text-sm text-slate-500">Загружаем баннеры…</p>}
      </div>
    </SectionCard>
  );
};
