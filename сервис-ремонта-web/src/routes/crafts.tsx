import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignPlacement } from "@/features/campaigns/campaign-banner";
import { CraftOrderCard } from "@/features/crafts/craft-order-card";

import {
  createCraftItem,
  createCraftOrder,
  getCraftItems,
  getCraftOrders,
  getStaff,
  updateCraftItem,
  uploadAdminImage,
} from "@/lib/api";

const CraftsPage = () => {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const [requestingItem, setRequestingItem] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customNote, setCustomNote] = useState("");
  const items = useQuery({
    queryKey: ["craft-items", token],
    queryFn: ({ signal }) => getCraftItems(token!, signal),
    enabled: Boolean(token),
  });
  const orders = useQuery({
    queryKey: ["craft-orders", token],
    queryFn: ({ signal }) => getCraftOrders(token!, signal),
    enabled: Boolean(token),
  });
  const staff = useQuery({
    queryKey: ["staff", token],
    queryFn: ({ signal }) => getStaff(token!, signal),
    enabled: user?.role === "ADMIN" && Boolean(token),
  });
  const refresh = async () => {
    await client.invalidateQueries({ queryKey: ["craft-items", token] });
    await client.invalidateQueries({ queryKey: ["craft-orders", token] });
  };
  const request = useMutation({
    mutationFn: (input: { itemId?: string; customTitle?: string; note: string }) =>
      createCraftOrder(token!, { ...input, quantity: 1 }),
    onSuccess: async () => {
      await refresh();
      setRequestingItem(null);
      setNote("");
      setCustomTitle("");
      setCustomNote("");
      toast.success("Заявка сохранена — администратор свяжется с вами.");
    },
  });
  const isAdmin = user?.role === "ADMIN";
  const canOrder = user?.role === "CUSTOMER";

  return (
    <AppShell active="/crafts">
      <PageTitle
        eyebrow="МАСТЕРСКАЯ"
        title="Ручная работа"
        description="Готовые изделия и изготовление под заказ. Оформите заявку — администратор подтвердит наличие и сроки."
      />
      <CampaignPlacement placement="CRAFTS" className="mb-5" />
      {isAdmin && <AdminCatalog items={items.data?.items ?? []} token={token!} onSaved={refresh} />}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(items.data?.items ?? [])
          .filter((item) => isAdmin || item.isPublished)
          .map((item) => (
            <SectionCard key={item.id} className="overflow-hidden p-0">
              <ProtectedImage
                objectId={item.imageObjectId}
                alt={item.title}
                loading="lazy"
                className="h-52 w-full object-cover"
              />
              <div className="p-5">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <p className="mt-2 min-h-12 text-sm leading-6 whitespace-pre-line text-slate-500">
                  {item.description}
                </p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-lg font-semibold">
                    {item.priceRub.toLocaleString("ru-RU")} ₽
                  </span>
                  {canOrder && (
                    <button
                      onClick={() => setRequestingItem(requestingItem === item.id ? null : item.id)}
                      className="min-h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
                    >
                      Заказать
                    </button>
                  )}
                </div>
                {canOrder && requestingItem === item.id && (
                  <form
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault();
                      request.mutate({ itemId: item.id, note });
                    }}
                    className="mt-4 grid gap-2"
                  >
                    <label className="text-xs font-medium">
                      Пожелания к заказу
                      <textarea
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        maxLength={2000}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                      />
                    </label>
                    <button
                      disabled={request.isPending}
                      className="min-h-9 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white"
                    >
                      {request.isPending ? "Отправляем…" : "Отправить заявку"}
                    </button>
                  </form>
                )}
                {isAdmin && (
                  <p className="mt-3 text-xs text-slate-400">
                    {item.isPublished ? "Опубликовано" : "Черновик"}
                    {item.customOrderAvailable ? " · возможен заказной вариант" : ""}
                  </p>
                )}
              </div>
            </SectionCard>
          ))}
        {items.isLoading && <p className="text-sm text-slate-500">Загружаем каталог…</p>}
        {!items.isLoading &&
          (items.data?.items.filter((item) => isAdmin || item.isPublished).length ?? 0) === 0 && (
            <SectionCard className="sm:col-span-2 xl:col-span-3">
              <p className="text-sm text-slate-500">В каталоге пока нет опубликованных изделий.</p>
            </SectionCard>
          )}
      </div>
      {canOrder && (
        <SectionCard className="mt-6">
          <h2 className="font-semibold">Индивидуальный заказ</h2>
          <p className="mt-1 text-sm text-slate-500">
            Опишите, что хотели бы заказать, а мастерская уточнит цену и сроки.
          </p>
          <form
            onSubmit={(event: FormEvent<HTMLFormElement>) => {
              event.preventDefault();
              request.mutate({ customTitle, note: customNote });
            }}
            className="mt-4 grid gap-3 md:grid-cols-2"
          >
            <label className="grid gap-1 text-sm font-medium">
              Что изготовить
              <input
                required
                minLength={2}
                maxLength={160}
                value={customTitle}
                onChange={(event) => setCustomTitle(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium md:row-span-2">
              Описание
              <textarea
                required
                minLength={2}
                maxLength={2000}
                value={customNote}
                onChange={(event) => setCustomNote(event.target.value)}
                rows={3}
                className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <button
              disabled={request.isPending}
              className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              Заказать изготовление
            </button>
          </form>
          {request.isError && (
            <p role="alert" className="mt-3 text-sm text-rose-600">
              Не удалось сохранить заявку. Войдите в аккаунт и повторите.
            </p>
          )}
        </SectionCard>
      )}
      {(canOrder || isAdmin) && (
        <section className="mt-8" id="craft-orders">
          <h2 className="mb-4 text-lg font-semibold">
            {isAdmin ? "Заявки на изделия" : "Мои заявки на изделия"}
          </h2>
          <div className="grid gap-3">
            {(orders.data?.orders ?? []).map((order) => (
              <CraftOrderCard
                key={order.id}
                order={order}
                token={token!}
                isAdmin={isAdmin}
                staff={staff.data?.staff ?? []}
                onRefresh={refresh}
              />
            ))}
            {!orders.isLoading && (orders.data?.orders.length ?? 0) === 0 && (
              <p className="text-sm text-slate-500">Заявок пока нет.</p>
            )}
          </div>
        </section>
      )}
      {!canOrder && !isAdmin && (
        <SectionCard className="mt-6">
          <p className="text-sm text-slate-500">
            Просмотр каталога доступен сотрудникам. Оформлять заказы могут клиенты.
          </p>
        </SectionCard>
      )}
    </AppShell>
  );
};

const AdminCatalog = ({
  items,
  token,
  onSaved,
}: {
  items: Awaited<ReturnType<typeof getCraftItems>>["items"];
  token: string;
  onSaved: () => Promise<void>;
}) => {
  const client = useQueryClient();
  const create = useMutation({
    mutationFn: (input: Parameters<typeof createCraftItem>[1]) => createCraftItem(token, input),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["craft-items", token] });
      await onSaved();
    },
  });
  const update = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { priceRub?: number; isPublished?: boolean };
    }) => updateCraftItem(token, id, data),
    onSuccess: () => client.invalidateQueries({ queryKey: ["craft-items", token] }),
  });
  return (
    <SectionCard className="mb-6">
      <h2 className="font-semibold">Управление изделиями</h2>
      <form
        onSubmit={(event: FormEvent<HTMLFormElement>) => {
          event.preventDefault();
          const form = event.currentTarget;
          const data = new FormData(form);
          const image = data.get("image");
          create.mutate(
            {
              title: String(data.get("title")),
              description: String(data.get("description")),
              priceRub: Number(data.get("priceRub")),
              isPublished: data.get("published") === "on",
              customOrderAvailable: data.get("custom") === "on",
            },
            {
              onSuccess: async ({ item }) => {
                if (image instanceof File && image.size) {
                  await uploadAdminImage(`/craft-items/${item.id}/image`, token, image);
                }
                form.reset();
                await onSaved();
              },
            },
          );
        }}
        className="mt-4 grid gap-3 md:grid-cols-2"
      >
        <label className="grid gap-1 text-sm font-medium">
          Название
          <input
            name="title"
            required
            minLength={2}
            maxLength={160}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Цена, ₽
          <input
            name="priceRub"
            type="number"
            required
            min={0}
            max={10000000}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium md:col-span-2">
          Описание
          <textarea
            name="description"
            maxLength={4000}
            rows={2}
            className="rounded-lg border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Фото
          <input
            name="image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="text-xs"
          />
        </label>
        <div className="grid content-center gap-2 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="published" className="size-4 accent-blue-600" />
            Опубликовать
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              name="custom"
              defaultChecked
              className="size-4 accent-blue-600"
            />
            Допускается заказной вариант
          </label>
        </div>
        <button
          disabled={create.isPending}
          className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
        >
          Добавить изделие
        </button>
        {create.isError && (
          <p role="alert" className="text-sm text-rose-600">
            Не удалось сохранить. Проверьте цену и фото.
          </p>
        )}
      </form>
      <div className="mt-5 grid gap-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 dark:border-slate-800"
          >
            <span className="text-sm font-medium">{item.title}</span>
            <div className="flex items-center gap-2">
              <input
                aria-label={`Цена изделия ${item.title}`}
                key={`${item.id}-${item.priceRub}`}
                type="number"
                min={0}
                max={10000000}
                defaultValue={item.priceRub}
                onBlur={(event) => {
                  const priceRub = Number(event.currentTarget.value);
                  if (priceRub !== item.priceRub)
                    update.mutate({ id: item.id, data: { priceRub } });
                }}
                className="h-9 w-28 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                onClick={() =>
                  update.mutate({ id: item.id, data: { isPublished: !item.isPublished } })
                }
                className="h-9 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700"
              >
                {item.isPublished ? "Снять" : "Опубликовать"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
};

export const Route = createFileRoute("/crafts")({ component: CraftsPage });
