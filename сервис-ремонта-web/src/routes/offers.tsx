import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CircleHelp, Gift, Trophy } from "lucide-react";
import { useState } from "react";
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
  onParticipate: (answerIndex?: number) => void;
}) => {
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const startsAt = new Date(offer.startsAt).getTime();
  const endsAt = new Date(offer.endsAt).getTime();
  const isUpcoming = now < startsAt;
  const isOpen = !isUpcoming && now < endsAt;
  const hasJoined = Boolean(offer.myParticipation);
  const isQuiz = offer.type === "QUIZ";
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
          {isQuiz ? (
            <CircleHelp size={21} aria-hidden="true" />
          ) : isGiveaway ? (
            <Trophy size={21} aria-hidden="true" />
          ) : (
            <Gift size={21} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-cyan-300">
            {isQuiz ? "Квиз" : isGiveaway ? "Розыгрыш" : "Акция"}
          </p>
          <h2 className="mt-1 text-lg font-semibold">{offer.title}</h2>
        </div>
      </div>

      <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{offer.content}</p>
      <p className="text-xs text-slate-400">
        {formatDate(offer.startsAt)} — {formatDate(offer.endsAt)}
      </p>

      {isQuiz && (
        <fieldset className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
          <legend className="px-1 font-semibold">{offer.quizQuestion}</legend>
          {offer.quizOptions.map((option, index) => {
            const answer = hasJoined ? offer.myParticipation?.answerIndex : selectedAnswer;
            const isCorrect = offer.resultsPublishedAt && offer.quizCorrectOption === index;
            return (
              <label
                key={`${offer.id}-${index}`}
                className={`flex cursor-pointer items-start gap-2 rounded-lg p-2 ${isCorrect ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" : ""}`}
              >
                <input
                  type="radio"
                  name={`quiz-${offer.id}`}
                  value={index}
                  checked={answer === index}
                  disabled={hasJoined || !isOpen}
                  onChange={() => setSelectedAnswer(index)}
                  className="mt-0.5 size-4 accent-blue-600"
                />
                <span>{option}</span>
                {isCorrect && <span className="ml-auto shrink-0 text-xs font-semibold">Верно</span>}
              </label>
            );
          })}
          {hasJoined && offer.resultsPublishedAt && (
            <p className="mt-1 text-xs font-medium">
              {offer.myParticipation?.answerCorrect
                ? "Вы ответили правильно — участвуете в розыгрыше."
                : "Ваш ответ был неверным. Спасибо за участие!"}
            </p>
          )}
        </fieldset>
      )}

      {(isGiveaway || isQuiz) && (
        <div className="grid gap-2 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900/70">
          <p className="font-semibold">Призы</p>
          {rewards.map((reward) => (
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
      ) : hasJoined && !isQuiz ? (
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Вы участвуете. Повторная запись не нужна.
        </p>
      ) : null}

      {(isGiveaway || isQuiz) && endsAt <= now && !offer.resultsPublishedAt && (
        <p className="text-sm text-slate-500">
          Приём завершён. Результаты опубликует администратор.
        </p>
      )}
      {!isGiveaway && !isQuiz && (
        <p className="text-xs text-slate-500">
          Запись фиксирует участие; стоимость заказа автоматически не меняется.
        </p>
      )}

      {isOpen && !hasJoined && (
        <button
          type="button"
          onClick={() => onParticipate(isQuiz ? (selectedAnswer ?? undefined) : undefined)}
          disabled={joining || (isQuiz && selectedAnswer === null)}
          className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {joining ? "Записываем…" : isQuiz ? "Ответить и участвовать" : "Участвовать"}
        </button>
      )}
      {isUpcoming && <p className="text-sm text-slate-500">Приём начнётся позже.</p>}
      {!isOpen && !isUpcoming && !hasJoined && !isGiveaway && (
        <p className="text-sm text-slate-500">Срок участия завершён.</p>
      )}
      {isQuiz && hasJoined && !offer.resultsPublishedAt && (
        <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
          Ответ принят. Повторная попытка не предусмотрена.
        </p>
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
    mutationFn: ({ offerId, answerIndex }: { offerId: string; answerIndex?: number }) =>
      participateInCustomerOffer(token!, offerId, answerIndex),
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
        title="Акции, розыгрыши и квизы"
        description="Участвуйте в предложениях сервиса и следите за опубликованными результатами."
      />
      {query.isLoading ? (
        <p className="text-sm text-slate-500">Загружаем предложения…</p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить акции, розыгрыши и квизы.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {query.data?.offers.map((offer) => (
            <OfferCard
              key={offer.id}
              offer={offer}
              now={now}
              joining={participate.isPending && participate.variables?.offerId === offer.id}
              onParticipate={(answerIndex) =>
                participate.mutate({ offerId: offer.id, answerIndex })
              }
            />
          ))}
          {!query.data?.offers.some((offer) => offer.type === "QUIZ") && (
            <SectionCard className="grid content-start gap-2">
              <h2 className="font-semibold">Квиз в разработке 👨‍💻</h2>
              <p className="text-sm leading-6 text-slate-500">
                Готовим первый вопрос о правильном уходе за компьютерами и ноутбуками.
              </p>
            </SectionCard>
          )}
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
