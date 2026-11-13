import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";
import { CampaignPlacement } from "@/features/campaigns/campaign-banner";
import { craftItemImageIds } from "@/features/crafts/craft-item-images";
import { CraftItemManagement } from "@/features/crafts/craft-item-management";
import { CraftOrderCard } from "@/features/crafts/craft-order-card";
import { CraftOrderPhotoPicker } from "@/features/crafts/craft-order-photo-picker";

import {
  createCraftOrder,
  getCraftItems,
  getCraftOrders,
  getStaff,
  uploadCraftOrderChatImage,
} from "@/lib/api";

export const CraftsWorkspace = ({ embedded = false }: { embedded?: boolean }) => {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const [requestingItem, setRequestingItem] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [customNote, setCustomNote] = useState("");
  const [itemPhotos, setItemPhotos] = useState<File[]>([]);
  const [customPhotos, setCustomPhotos] = useState<File[]>([]);
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
    mutationFn: async (input: {
      itemId?: string;
      customTitle?: string;
      note: string;
      photos: File[];
    }) => {
      const { photos, ...orderInput } = input;
      const { order } = await createCraftOrder(token!, { ...orderInput, quantity: 1 });
      const uploads = await Promise.allSettled(
        photos.map((file) => uploadCraftOrderChatImage(token!, order.id, file)),
      );
      return { failedPhotoCount: uploads.filter((upload) => upload.status === "rejected").length };
    },
    onSuccess: async ({ failedPhotoCount }) => {
      await refresh();
      setRequestingItem(null);
      setNote("");
      setCustomTitle("");
      setCustomNote("");
      setItemPhotos([]);
      setCustomPhotos([]);
      if (failedPhotoCount > 0) {
        toast.error(
          "Заявка создана, но не все фото прикрепились. Откройте чат заявки и отправьте их ещё раз.",
        );
      } else {
        toast.success("Заявка сохранена — администратор свяжется с вами.");
      }
    },
  });
  const isAdmin = user?.role === "ADMIN";
  const canOrder = user?.role === "CUSTOMER";

  const content = (
    <>
      {!embedded && (
        <PageTitle
          eyebrow="МАСТЕРСКАЯ"
          title="Изготовление на заказ"
          description="Готовые изделия находятся в магазине. Здесь можно обсудить индивидуальную работу, её цену и сроки. Доставку согласуем после изготовления."
        />
      )}
      {!embedded && <CampaignPlacement placement="CRAFTS" className="mb-5" />}
      {isAdmin && (
        <CraftItemManagement items={items.data?.items ?? []} token={token!} onSaved={refresh} />
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(items.data?.items ?? [])
          .filter((item) => isAdmin || (item.isPublished && item.customOrderAvailable))
          .map((item) => (
            <SectionCard key={item.id} className="overflow-hidden p-0">
              <ProtectedImage
                objectId={craftItemImageIds(item)[0] ?? null}
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
                      Обсудить изготовление
                    </button>
                  )}
                </div>
                {canOrder && requestingItem === item.id && (
                  <form
                    onSubmit={(event: FormEvent<HTMLFormElement>) => {
                      event.preventDefault();
                      request.mutate({ itemId: item.id, note, photos: itemPhotos });
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
                    <CraftOrderPhotoPicker
                      files={itemPhotos}
                      onChange={setItemPhotos}
                      disabled={request.isPending}
                    />
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
              <p className="text-sm text-slate-500">
                Пока нет опубликованных изделий, доступных для изготовления на заказ.
              </p>
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
              request.mutate({ customTitle, note: customNote, photos: customPhotos });
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
            <div className="md:col-span-2">
              <CraftOrderPhotoPicker
                files={customPhotos}
                onChange={setCustomPhotos}
                disabled={request.isPending}
              />
            </div>
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
    </>
  );
  return embedded ? (
    <div className="space-y-5">{content}</div>
  ) : (
    <AppShell active="/crafts">{content}</AppShell>
  );
};
