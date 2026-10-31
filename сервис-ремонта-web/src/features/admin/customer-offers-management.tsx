import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, Unlock, X } from "lucide-react";
import { type FormEvent, useState } from "react";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";

import {
  type AdminCustomerOffer,
  type CreateCustomerOfferInput,
  type CustomerOfferType,
  createAdminCustomerOffer,
  deleteAdminCustomerOffer,
  drawAdminCustomerOffer,
  getAdminCustomerOffers,
  publishAdminCustomerOfferResults,
  updateAdminCustomerOffer,
} from "@/lib/api";
import { useCurrentTime } from "@/lib/current-time";

const formatDate = (value: string) => new Date(value).toLocaleString("ru-RU");

const offerStatus = (offer: AdminCustomerOffer, now: number) => {
  if (!offer.isPublished) return "Черновик · скрыта от клиентов";
  if (new Date(offer.startsAt).getTime() > now) return "Запланирована";
  if (new Date(offer.endsAt).getTime() > now) return "Приём открыт";
  if (offer.type !== "GIVEAWAY") return "Акция завершена";
  if (offer.resultsPublishedAt) return "Победители опубликованы";
  if (offer.drawnAt) return "Результаты готовы к публикации";
  return "Приём завершён · ожидает жеребьёвки";
};

const PlaceRewardFields = ({
  place,
  prizeName,
  pointsName,
  defaultPoints,
}: {
  place: number;
  prizeName: string;
  pointsName: string;
  defaultPoints: number;
}) => (
  <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
    <legend className="px-1 text-sm font-semibold">{place}-е место</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Приз
        <input
          name={prizeName}
          maxLength={500}
          placeholder="Например, сертификат или подарок"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Баллы победителю
        <input
          name={pointsName}
          type="number"
          min={0}
          max={100000}
          step={1}
          defaultValue={defaultPoints}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
    </div>
  </fieldset>
);

export const CustomerOffersManagement = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const now = useCurrentTime();
  const [type, setType] = useState<CustomerOfferType>("GIVEAWAY");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDrawId, setConfirmDrawId] = useState<string | null>(null);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);

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
    mutationFn: (input: CreateCustomerOfferInput) => createAdminCustomerOffer(token!, input),
    onSuccess: async () => {
      setError("");
      setNotice("Предложение сохранено. Оно будет видно клиентам по заданному расписанию.");
      await refresh();
    },
    onError: () => setError("Не удалось сохранить предложение. Проверьте даты и призы."),
  });

  const setPublished = useMutation({
    mutationFn: ({ offerId, isPublished }: { offerId: string; isPublished: boolean }) =>
      updateAdminCustomerOffer(token!, offerId, isPublished),
    onSuccess: async (_result, variables) => {
      setNotice(
        variables.isPublished ? "Предложение опубликовано." : "Предложение скрыто от клиентов.",
      );
      await refresh();
    },
    onError: () => setError("Не удалось изменить публикацию предложения."),
  });

  const removeOffer = useMutation({
    mutationFn: (offerId: string) => deleteAdminCustomerOffer(token!, offerId),
    onSuccess: async () => {
      setError("");
      setNotice("Акция или розыгрыш удалены вместе с записями участников.");
      await refresh();
    },
    onError: () => setError("Не удалось удалить публикацию. Обновите список и попробуйте снова."),
  });

  const draw = useMutation({
    mutationFn: (offerId: string) => drawAdminCustomerOffer(token!, offerId),
    onSuccess: async () => {
      setConfirmDrawId(null);
      setNotice("Победители выбраны. Проверьте три места и отдельно опубликуйте результаты.");
      await refresh();
    },
    onError: () => setError("Не удалось выбрать победителей. Проверьте срок и число участников."),
  });

  const publishResults = useMutation({
    mutationFn: (offerId: string) => publishAdminCustomerOfferResults(token!, offerId),
    onSuccess: async () => {
      setConfirmPublishId(null);
      setNotice("Результаты опубликованы; баллы за призовые места начислены победителям.");
      await refresh();
    },
    onError: () => setError("Не удалось опубликовать результаты. Повторите попытку."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const startsAt = String(form.get("startsAt") ?? "");
    const endsAt = String(form.get("endsAt") ?? "");
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setError("Укажите срок окончания позже срока начала.");
      return;
    }
    const prizeValue = (name: string) => String(form.get(name) ?? "").trim() || null;
    const pointsValue = (name: string) => Number(form.get(name) ?? 0);
    const firstPlacePrize = type === "GIVEAWAY" ? prizeValue("firstPlacePrize") : null;
    const firstPlacePoints = type === "GIVEAWAY" ? pointsValue("firstPlacePoints") : 0;
    const secondPlacePrize = type === "GIVEAWAY" ? prizeValue("secondPlacePrize") : null;
    const secondPlacePoints = type === "GIVEAWAY" ? pointsValue("secondPlacePoints") : 0;
    const thirdPlacePrize = type === "GIVEAWAY" ? prizeValue("thirdPlacePrize") : null;
    const thirdPlacePoints = type === "GIVEAWAY" ? pointsValue("thirdPlacePoints") : 0;
    if (
      type === "GIVEAWAY" &&
      [
        [firstPlacePrize, firstPlacePoints],
        [secondPlacePrize, secondPlacePoints],
        [thirdPlacePrize, thirdPlacePoints],
      ].some(([prize, points]) => !prize && Number(points) <= 0)
    ) {
      setError("Для каждого места укажите приз или количество баллов.");
      return;
    }

    create.mutate(
      {
        type,
        title: String(form.get("title") ?? "").trim(),
        content: String(form.get("content") ?? "").trim(),
        firstPlacePrize,
        firstPlacePoints,
        secondPlacePrize,
        secondPlacePoints,
        thirdPlacePrize,
        thirdPlacePoints,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        isPublished: form.get("isPublished") === "on",
      },
      { onSuccess: () => formElement.reset() },
    );
  };

  return (
    <div className="grid gap-5">
      <SectionCard>
        <h2 className="font-semibold">Акция или розыгрыш для клиентов</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">
          Опубликованные предложения появятся у клиентов в Web и Android. Участие фиксируется в
          аккаунте; акции не меняют стоимость заказа автоматически.
        </p>

        <form onSubmit={submit} className="mt-5 grid gap-4">
          <fieldset className="grid gap-2">
            <legend className="text-sm font-medium">Тип предложения</legend>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ["GIVEAWAY", "Розыгрыш"],
                  ["PROMOTION", "Акция"],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-medium ${type === value ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-cyan-200" : "border-slate-200 dark:border-slate-700"}`}
                >
                  <input
                    type="radio"
                    name="offerType"
                    value={value}
                    checked={type === value}
                    onChange={() => setType(value)}
                    className="accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="grid gap-1.5 text-sm font-medium">
            Название
            <input
              name="title"
              required
              minLength={2}
              maxLength={160}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Описание и условия участия
            <textarea
              name="content"
              required
              minLength={1}
              maxLength={8000}
              rows={4}
              className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>

          {type === "GIVEAWAY" && (
            <div className="grid gap-3">
              <h3 className="text-sm font-semibold">Награды по местам</h3>
              <p className="text-xs leading-5 text-slate-500">
                Для каждого места задайте приз, баллы или оба варианта. Баллы появятся в истории
                победителя, когда вы опубликуете результаты.
              </p>
              <PlaceRewardFields
                place={1}
                prizeName="firstPlacePrize"
                pointsName="firstPlacePoints"
                defaultPoints={0}
              />
              <PlaceRewardFields
                place={2}
                prizeName="secondPlacePrize"
                pointsName="secondPlacePoints"
                defaultPoints={0}
              />
              <PlaceRewardFields
                place={3}
                prizeName="thirdPlacePrize"
                pointsName="thirdPlacePoints"
                defaultPoints={0}
              />
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Начало приёма
              <input
                type="datetime-local"
                name="startsAt"
                required
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Окончание приёма
              <input
                type="datetime-local"
                name="endsAt"
                required
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="isPublished" className="size-4 accent-blue-600" />
            Опубликовать сразу (иначе сохранить черновиком)
          </label>
          {(error || create.isError) && (
            <p role="alert" className="text-sm text-rose-600">
              {error || "Не удалось сохранить предложение."}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">
              {notice}
            </p>
          )}
          <button
            type="submit"
            disabled={create.isPending}
            className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {create.isPending ? "Сохраняем…" : "Сохранить предложение"}
          </button>
        </form>
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
                    {[1, 2, 3].map((place) => {
                      const reward = [
                        { prize: offer.firstPlacePrize, points: offer.firstPlacePoints },
                        { prize: offer.secondPlacePrize, points: offer.secondPlacePoints },
                        { prize: offer.thirdPlacePrize, points: offer.thirdPlacePoints },
                      ][place - 1]!;
                      return (
                        <p key={place}>
                          <span className="font-semibold">{place}-е место:</span>{" "}
                          {reward.prize || "без отдельного подарка"}
                          {reward.points > 0 ? ` · ${reward.points} баллов` : ""}
                        </p>
                      );
                    })}
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
                        {winner.bonusPoints > 0 ? ` · начислено ${winner.bonusPoints} баллов` : ""}
                      </p>
                    ))}
                  </div>
                )}

                {offer.type === "GIVEAWAY" &&
                  ended &&
                  !offer.drawnAt &&
                  (offer.participantCount < 3 ? (
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      Для выбора трёх мест нужно не менее трёх участников.
                    </p>
                  ) : confirmDrawId === offer.id ? (
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span>Случайно выбрать 1-е, 2-е и 3-е места?</span>
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
