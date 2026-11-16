import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Gift, Trophy } from "lucide-react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { ProtectedImage } from "@/components/protected-image";

import { useAuth } from "@/features/auth/auth-context";
import { BenefitsNavigation } from "@/features/navigation/benefits-navigation";

import { type CustomerOffer, getCustomerOffers, participateInCustomerOffer } from "@/lib/api";
import { useCurrentTime } from "@/lib/current-time";

const formatDate = (value: string) => new Date(value).toLocaleString("ru-RU");

const OfferCard = ({
  offer,
  now,
  joining,
  onParticipate,
}: {
  offer: CustomerOffer;
  now: number;
  joining: boolean;
  onParticipate: () => void;
}) => {
  const startsAt = new Date(offer.startsAt).getTime();
  const endsAt = new Date(offer.endsAt).getTime();
  const isUpcoming = now < startsAt;
  const isOpen = !isUpcoming && now < endsAt;
  const hasJoined = Boolean(offer.myParticipation);
  const isGiveaway = offer.type === "GIVEAWAY";
  const rewards = [
    {
      place: 1,
      prize: offer.firstPlacePrize,
      bonusPoints: offer.firstPlacePoints,
      imageObjectId: offer.firstPlacePrizeImageId,
    },
    {
      place: 2,
      prize: offer.secondPlacePrize,
      bonusPoints: offer.secondPlacePoints,
      imageObjectId: offer.secondPlacePrizeImageId,
    },
    {
      place: 3,
      prize: offer.thirdPlacePrize,
      bonusPoints: offer.thirdPlacePoints,
      imageObjectId: offer.thirdPlacePrizeImageId,
    },
  ];
  const myReward = rewards.find((reward) => reward.place === offer.myParticipation?.place);

  return (
    <SectionCard className="grid content-start gap-4">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-cyan-200">
          {isGiveaway ? (
            <Trophy size={21} aria-hidden="true" />
          ) : (
            <Gift size={21} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-cyan-300">
            {isGiveaway ? "Розыгрыш" : "Акция"}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{offer.title}</h2>
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{offer.content}</p>
      <p className="text-xs text-slate-400">
        {formatDate(offer.startsAt)} — {formatDate(offer.endsAt)}
      </p>

      {isGiveaway && (
        <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
          <p className="font-semibold">Призы</p>
          {rewards
            .filter((reward) => Boolean(reward.prize?.trim()) || reward.bonusPoints > 0)
            .map((reward) => (
              <div
                key={reward.place}
                className="flex items-center gap-3 text-slate-600 dark:text-slate-300"
              >
                {reward.imageObjectId && (
                  <ProtectedImage
                    objectId={reward.imageObjectId}
                    alt={`Фото приза за ${reward.place}-е место`}
                    className="size-16 shrink-0 rounded-lg object-cover"
                  />
                )}
                <p>
                  {reward.place}-е место: {reward.prize || ""}
                  {reward.prize && reward.bonusPoints > 0 ? " · " : ""}
                  {reward.bonusPoints > 0 ? `${reward.bonusPoints} баллов` : ""}
                </p>
              </div>
            ))}
        </div>
      )}

      {offer.resultsPublishedAt && offer.winners.length > 0 && (
        <section className="grid gap-2 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm dark:border-emerald-900 dark:bg-emerald-950/30">
          <h3 className="font-semibold">Победители</h3>
          {offer.winners.map((winner) => (
            <p key={winner.place}>
              {winner.place}-е место — {winner.displayName}
              {winner.prize ? ` · ${winner.prize}` : ""}
              {winner.bonusPoints > 0 ? ` · ${winner.bonusPoints} баллов` : ""}
            </p>
          ))}
        </section>
      )}

      {hasJoined && offer.myParticipation?.place ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          Поздравляем! Вы заняли {offer.myParticipation.place}-е место.
          {myReward?.bonusPoints ? ` Начислено ${myReward.bonusPoints} баллов.` : ""}
        </div>
      ) : hasJoined ? (
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Вы участвуете. Повторная запись не нужна.
        </p>
      ) : null}

      {isGiveaway && endsAt <= now && !offer.resultsPublishedAt && (
        <p className="text-sm text-slate-500">
          Приём завершён. Результаты опубликует администратор.
        </p>
      )}
      {!isGiveaway && (
        <p className="text-xs text-slate-500">
          Запись фиксирует участие; стоимость заказа автоматически не меняется.
        </p>
      )}

      {isOpen && !hasJoined && (
        <button
          type="button"
          onClick={onParticipate}
          disabled={joining}
          className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {joining ? "Записываем…" : "Участвовать"}
        </button>
      )}
      {isUpcoming && <p className="text-sm text-slate-500">Приём начнётся позже.</p>}
      {!isOpen && !isUpcoming && !hasJoined && !isGiveaway && (
        <p className="text-sm text-slate-500">Срок участия завершён.</p>
      )}
    </SectionCard>
  );
};

const OffersPage = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const now = useCurrentTime();
  const query = useQuery({
    queryKey: ["customer-offers", token],
    queryFn: ({ signal }) => getCustomerOffers(token!, signal),
    enabled: Boolean(token),
  });
  const participate = useMutation({
    mutationFn: ({ offerId }: { offerId: string }) => participateInCustomerOffer(token!, offerId),
    onSuccess: async (result) => {
      toast.success(result.alreadyParticipating ? "Вы уже участвуете." : "Вы записаны на участие.");
      await queryClient.invalidateQueries({ queryKey: ["customer-offers", token] });
    },
    onError: () =>
      toast.error("Не удалось записать участие. Обновите страницу и попробуйте снова."),
  });

  return (
    <AppShell active="/offers">
      {user?.role === "CUSTOMER" && <BenefitsNavigation />}
      <PageTitle
        eyebrow="ДЛЯ КЛИЕНТОВ"
        title="Акции и розыгрыши"
        description="Участвуйте в предложениях сервиса и следите за опубликованными результатами."
      />
      {query.isLoading ? (
        <p className="text-sm text-slate-500">Загружаем предложения…</p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить акции и розыгрыши.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {query.data?.offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              now={now}
              joining={participate.isPending && participate.variables?.offerId === offer.id}
              onParticipate={() => participate.mutate({ offerId: offer.id })}
            />
          ))}
          {(query.data?.offers.length ?? 0) === 0 && (
            <SectionCard>
              <p className="text-sm text-slate-500">Сейчас нет опубликованных предложений.</p>
            </SectionCard>
          )}
        </div>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/offers")({ component: OffersPage });
