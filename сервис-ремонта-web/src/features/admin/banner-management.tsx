import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";

import { SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";

import { createBanner, getBanners, updateBanner, uploadAdminImage } from "@/lib/api";

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
    const image = values.get("image");
    create.mutate(
      {
        title: String(values.get("title")),
        content: String(values.get("content")),
        targetUrl: String(values.get("targetUrl") || "") || null,
        startsAt: iso(starts),
        endsAt: iso(ends),
        isActive: values.get("isActive") === "on",
      },
      {
        onSuccess: async ({ banner }) => {
          if (image instanceof File && image.size)
            await uploadAdminImage(`/banners/${banner.id}/image`, token!, image);
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
        Активный баннер показывается в приоритетной зоне главной страницы в указанный период.
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
          Ссылка, необязательно
          <input
            name="targetUrl"
            type="url"
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          Текст
          <textarea
            name="content"
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
        <label className="grid gap-1 text-sm font-medium">
          Окончание показа
          <input
            type="datetime-local"
            name="endsAt"
            className="h-10 rounded-lg border border-slate-200 bg-white px-2 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Изображение
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-xs"
          />
        </label>
        <label className="flex items-center gap-2 self-center text-sm">
          <input type="checkbox" name="isActive" className="size-4 accent-blue-600" />
          Активировать
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
            <ProtectedImage
              objectId={banner.imageObjectId}
              alt=""
              className="size-16 rounded-lg object-cover"
            />
            <div className="min-w-40 flex-1">
              <h3 className="text-sm font-semibold">{banner.title}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {banner.startsAt ? new Date(banner.startsAt).toLocaleString("ru-RU") : "Сразу"}
                {banner.endsAt
                  ? ` — ${new Date(banner.endsAt).toLocaleString("ru-RU")}`
                  : " — без даты окончания"}
              </p>
            </div>
            <button
              onClick={() => update.mutate({ id: banner.id, data: { isActive: !banner.isActive } })}
              className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700"
            >
              {banner.isActive ? "Отключить" : "Активировать"}
            </button>
          </article>
        ))}
        {query.isLoading && <p className="text-sm text-slate-500">Загружаем баннеры…</p>}
      </div>
    </SectionCard>
  );
};
