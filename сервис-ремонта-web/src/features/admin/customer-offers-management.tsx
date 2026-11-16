import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  type AdminCustomerOffer,
  ApiRequestError,
  type CreateCustomerOfferInput,
  createAdminCustomerOffer,
  deleteAdminCustomerOffer,
  drawAdminCustomerOffer,
  getAdminCustomerOffers,
  publishAdminCustomerOfferResults,
  updateAdminCustomerOffer,
  uploadAdminCustomerOfferPrizeImage,
} from "@/lib/api";
import { useCurrentTime } from "@/lib/current-time";

import { CustomerOfferCreateForm } from "./customer-offer-create-form";
import { CustomerOfferPrizeImageControl } from "./customer-offer-prize-image-control";

const formatDate = (value: string) => new Date(value).toLocaleString("ru-RU");

const getConfiguredRewardCount = (offer: AdminCustomerOffer) =>
  [
    { prize: offer.firstPlacePrize, points: offer.firstPlacePoints },
    { prize: offer.secondPlacePrize, points: offer.secondPlacePoints },
    { prize: offer.thirdPlacePrize, points: offer.thirdPlacePoints },
  ].filter(({ prize, points }) => Boolean(prize?.trim()) || points > 0).length;

const offerStatus = (offer: AdminCustomerOffer, now: number) => {
  if (!offer.isPublished) return "Черновик · скрыта от клиентов";
  if (new Date(offer.startsAt).getTime() > now) return "Запланирована";
  if (new Date(offer.endsAt).getTime() > now) return "Приём открыт";
  if (offer.type !== "GIVEAWAY") return "Акция завершена";
  if (offer.resultsPublishedAt) return "Победители опубликованы";
  if (offer.drawnAt) return "Результаты готовы к публикации";
  return "Приём завершён · ожидает жеребьёвки";
};

export const CustomerOffersManagement = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const now = useCurrentTime();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDrawId, setConfirmDrawId] = useState<string | null>(null);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);

  const showError = (message: string) => {
    setError(message);
    toast.error(message);
  };
  const showNotice = (message: string, warning = false) => {
    setNotice(message);
    if (warning) toast.warning(message);
    else toast.success(message);
  };

  const query = useQuery({
    queryKey: ["admin-offers", token],
    queryFn: ({ signal }) => getAdminCustomerOffers(token!, signal),
    enabled: Boolean(token),
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["admin-offers", token] }),
      queryClient.invalidateQueries({ queryKey: ["customer-offers"] }),
    ]);
  };

  const create = useMutation({
    mutationFn: async ({
      input,
      prizeImages,
    }: {
      input: CreateCustomerOfferInput;
      prizeImages: (File | null)[];
      clear: () => void;
    }) => {
      const selectedImages = prizeImages
        .map((file, index) => (file ? { file, place: index + 1 } : null))
        .filter((image): image is { file: File; place: number } => image !== null);
      const created = await createAdminCustomerOffer(token!, {
        ...input,
        isPublished: selectedImages.length > 0 ? false : input.isPublished,
      });
      let photosSaved = true;
      for (const { file, place } of selectedImages) {
        try {
          await uploadAdminCustomerOfferPrizeImage(token!, created.offer.id, place, file);
        } catch {
          photosSaved = false;
          break;
        }
      }
      let publishFailed = false;
      if (photosSaved && selectedImages.length > 0 && input.isPublished) {
        try {
          await updateAdminCustomerOffer(token!, created.offer.id, true);
        } catch {
          publishFailed = true;
        }
      }
      return { photosSaved, publishFailed, hasPhotos: selectedImages.length > 0 };
    },
    onSuccess: async (result, variables) => {
      variables.clear();
      setError("");
      const warning = !result.photosSaved || result.publishFailed;
      showNotice(
        !result.photosSaved
          ? "Черновик сохранён, но не все фото загрузились. Добавьте их в списке предложений."
          : result.publishFailed
            ? "Фото сохранены, но опубликовать предложение не удалось — оно осталось черновиком."
            : result.hasPhotos && variables.input.isPublished
              ? "Фото сохранены, предложение опубликовано по заданному расписанию."
              : "Предложение сохранено. Оно будет видно клиентам по заданному расписанию.",
        warning,
      );
      await refresh();
    },
    onError: (error) =>
      showError(
        error instanceof ApiRequestError
          ? error.message
          : "Не удалось сохранить предложение. Проверьте даты и призы.",
      ),
  });

  const setPublished = useMutation({
    mutationFn: ({ offerId, isPublished }: { offerId: string; isPublished: boolean }) =>
      updateAdminCustomerOffer(token!, offerId, isPublished),
    onSuccess: async (_result, variables) => {
      showNotice(
        variables.isPublished ? "Предложение опубликовано." : "Предложение скрыто от клиентов.",
      );
      await refresh();
    },
    onError: () => showError("Не удалось изменить публикацию предложения."),
  });

  const removeOffer = useMutation({
    mutationFn: (offerId: string) => deleteAdminCustomerOffer(token!, offerId),
    onSuccess: async () => {
      setError("");
      showNotice("Акция или розыгрыш удалены вместе с записями участников.");
      await refresh();
    },
    onError: () => showError("Не удалось удалить публикацию. Обновите список и попробуйте снова."),
  });

  const draw = useMutation({
    mutationFn: (offerId: string) => drawAdminCustomerOffer(token!, offerId),
    onSuccess: async () => {
      setConfirmDrawId(null);
      showNotice("Победители выбраны. Проверьте призовые места и отдельно опубликуйте результаты.");
      await refresh();
    },
    onError: () => showError("Не удалось выбрать победителей. Проверьте срок и число участников."),
  });

  const publishResults = useMutation({
    mutationFn: (offerId: string) => publishAdminCustomerOfferResults(token!, offerId),
    onSuccess: async () => {
      setConfirmPublishId(null);
      showNotice("Результаты опубликованы; баллы за призовые места начислены победителям.");
      await refresh();
    },
    onError: () => showError("Не удалось опубликовать результаты. Повторите попытку."),
  });

  const handleCreate = (
    input: CreateCustomerOfferInput,
    prizeImages: (File | null)[],
    clear: () => void,
  ) => {
    setError("");
    setNotice("");
    create.mutate({ input, prizeImages, clear });
  };

  return (
    <div className="grid gap-5">
      <SectionCard>
        <h2 className="font-semibold">Акция или розыгрыш для клиентов</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Создайте акцию или розыгрыш, выберите награды при необходимости и задайте срок участия.
        </p>
        <CustomerOfferCreateForm
          saving={create.isPending}
          error={error || (create.isError ? "Не удалось сохранить предложение." : "")}
          notice={notice}
          onCreate={handleCreate}
        />
      </SectionCard>

      <SectionCard>
        <h2 className="mb-4 font-semibold">Предложения и результаты</h2>
        <div className="grid gap-3">
          {(query.data?.offers ?? []).map((offer) => {
            const ended = new Date(offer.endsAt).getTime() <= now;
            return (
              <article
                key={offer.id}
                className="grid gap-3 rounded-xl border border-slate-100 p-4 dark:border-slate-800"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-48 flex-1">
                    <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-cyan-300">
                      {offer.type === "GIVEAWAY" ? "Розыгрыш" : "Акция"} · {offerStatus(offer, now)}
                    </p>
                    <h3 className="mt-1 font-semibold">{offer.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{offer.content}</p>
                    <p className="mt-2 text-xs text-slate-400">
                      {formatDate(offer.startsAt)} — {formatDate(offer.endsAt)} · Участников:{" "}
                      {offer.participantCount}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setPublished.mutate({ offerId: offer.id, isPublished: !offer.isPublished })
                      }
                      disabled={setPublished.isPending}
                      aria-label={
                        offer.isPublished
                          ? `Скрыть: ${offer.title}`
                          : `Опубликовать: ${offer.title}`
                      }
                      title={offer.isPublished ? "Скрыть" : "Опубликовать"}
                      className="grid size-9 place-items-center rounded-lg border border-slate-200 dark:border-slate-700"
                    >
                      {offer.isPublished ? (
                        <Lock size={16} aria-hidden="true" />
                      ) : (
                        <Unlock size={16} aria-hidden="true" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label={`Удалить «${offer.title}»`}
                      title="Удалить акцию или розыгрыш"
                      disabled={removeOffer.isPending}
                      onClick={() => {
                        const participationWarning =
                          offer.participantCount > 0
                            ? ` Вместе с публикацией будут удалены записи ${offer.participantCount} участников.`
                            : "";
                        if (window.confirm(`Удалить «${offer.title}»?${participationWarning}`)) {
                          removeOffer.mutate(offer.id);
                        }
                      }}
                      className="grid size-9 place-items-center rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                    >
                      <X size={16} aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {offer.type === "GIVEAWAY" && (
                  <div className="grid gap-2 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
                    {[
                      {
                        place: 1,
                        prize: offer.firstPlacePrize,
                        points: offer.firstPlacePoints,
                        imageObjectId: offer.firstPlacePrizeImageId,
                      },
                      {
                        place: 2,
                        prize: offer.secondPlacePrize,
                        points: offer.secondPlacePoints,
                        imageObjectId: offer.secondPlacePrizeImageId,
                      },
                      {
                        place: 3,
                        prize: offer.thirdPlacePrize,
                        points: offer.thirdPlacePoints,
                        imageObjectId: offer.thirdPlacePrizeImageId,
                      },
                    ]
                      .filter(({ prize, points }) => Boolean(prize?.trim()) || points > 0)
                      .map(({ place, prize, points, imageObjectId }) => (
                        <div
                          key={place}
                          className="grid gap-2 border-b border-slate-200 pb-2 last:border-0 last:pb-0 dark:border-slate-800"
                        >
                          <p>
                            <span className="font-semibold">{place}-е место:</span>{" "}
                            {prize || "без отдельного подарка"}
                            {points > 0 ? ` · ${points} баллов` : ""}
                          </p>
                          {token && (
                            <CustomerOfferPrizeImageControl
                              token={token}
                              offerId={offer.id}
                              place={place}
                              imageObjectId={imageObjectId}
                              onChanged={refresh}
                            />
                          )}
                        </div>
                      ))}
                  </div>
                )}

                {offer.winners.length > 0 && (
                  <div className="grid gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
                    <p className="font-semibold">
                      Победители{" "}
                      {offer.resultsPublishedAt
                        ? "(результаты опубликованы)"
                        : "(видно только администратору)"}
                    </p>
                    {offer.winners.map((winner) => (
                      <p key={winner.place}>
                        {winner.place}-е место — {winner.displayName}
                        {winner.bonusPoints > 0
                          ? ` · ${offer.resultsPublishedAt ? "начислено" : "будет начислено"} ${winner.bonusPoints} баллов`
                          : ""}
                      </p>
                    ))}
                  </div>
                )}
                {offer.type === "GIVEAWAY" &&
                  ended &&
                  !offer.drawnAt &&
                  (offer.participantCount < getConfiguredRewardCount(offer) ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Для выбора {getConfiguredRewardCount(offer)} мест нужно не менее{" "}
                      {getConfiguredRewardCount(offer)} участников.
                    </p>
                  ) : confirmDrawId === offer.id ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>
                        Случайно выбрать до {getConfiguredRewardCount(offer)} призовых мест?
                      </span>
                      <button
                        type="button"
                        onClick={() => draw.mutate(offer.id)}
                        disabled={draw.isPending}
                        className="min-h-9 rounded-lg bg-blue-600 px-3 font-semibold text-white disabled:opacity-60"
                      >
                        {draw.isPending ? "Выбираем…" : "Подтвердить жеребьёвку"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDrawId(null)}
                        className="min-h-9 px-3 text-slate-500"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDrawId(offer.id)}
                      className="min-h-10 justify-self-start rounded-xl border border-blue-200 px-4 text-sm font-semibold text-blue-700 dark:border-blue-900 dark:text-cyan-200"
                    >
                      Выбрать победителей случайно
                    </button>
                  ))}

                {offer.type === "GIVEAWAY" &&
                  offer.drawnAt &&
                  !offer.resultsPublishedAt &&
                  (confirmPublishId === offer.id ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Опубликовать имена победителей и начислить баллы?</span>
                      <button
                        type="button"
                        onClick={() => publishResults.mutate(offer.id)}
                        disabled={publishResults.isPending}
                        className="min-h-9 rounded-lg bg-emerald-600 px-3 font-semibold text-white disabled:opacity-60"
                      >
                        {publishResults.isPending ? "Публикуем…" : "Опубликовать результаты"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmPublishId(null)}
                        className="min-h-9 px-3 text-slate-500"
                      >
                        Отмена
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmPublishId(offer.id)}
                      className="min-h-10 justify-self-start rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
                    >
                      Опубликовать победителей и начислить баллы
                    </button>
                  ))}
              </article>
            );
          })}
          {query.isLoading && <p className="text-sm text-slate-500">Загружаем предложения…</p>}
          {query.isError && (
            <p role="alert" className="text-sm text-rose-600">
              Не удалось загрузить предложения.
            </p>
          )}
          {!query.isLoading && !query.isError && (query.data?.offers.length ?? 0) === 0 && (
            <p className="text-sm text-slate-500">Предложений пока нет.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
};
