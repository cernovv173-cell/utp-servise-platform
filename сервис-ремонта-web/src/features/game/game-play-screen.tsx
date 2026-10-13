import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Gamepad2, Sparkles, Star } from "lucide-react";
import { useState } from "react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import {
  type GameCompletionResult,
  type GameEpisode,
  completeGameEpisode,
  getGameEpisodes,
  submitGameAnswer,
} from "@/features/game/game-api";

const GAME_QUERY_KEY = ["game-episodes"];

export const GamePlayScreen = () => {
  const { token, user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedEpisodeId, setSelectedEpisodeId] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Array<{ questionId: string; optionId: string }>>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<string | null>(null);
  const [answerCorrect, setAnswerCorrect] = useState(false);
  const [feedbackKey, setFeedbackKey] = useState(0);
  const [completion, setCompletion] = useState<GameCompletionResult | null>(null);

  const episodesQuery = useQuery({
    queryKey: [...GAME_QUERY_KEY, token],
    queryFn: ({ signal }) => getGameEpisodes(token!, signal),
    enabled: Boolean(token && user?.role === "CUSTOMER"),
  });

  const episode = episodesQuery.data?.episodes.find(({ id }) => id === selectedEpisodeId);
  const question = episode?.questions[questionIndex];

  const answerMutation = useMutation({
    mutationFn: ({
      episode,
      questionId,
      optionId,
    }: {
      episode: GameEpisode;
      questionId: string;
      optionId: string;
    }) => submitGameAnswer(token!, episode.id, questionId, optionId),
    onSuccess: (result, variables) => {
      setAnswerFeedback(result.feedback);
      setAnswerCorrect(result.correct);
      setFeedbackKey((value) => value + 1);
      if (result.correct) {
        setAnswers((current) => {
          const remaining = current.filter((answer) => answer.questionId !== variables.questionId);
          return [...remaining, { questionId: variables.questionId, optionId: variables.optionId }];
        });
      }
    },
  });

  const completionMutation = useMutation({
    mutationFn: () => completeGameEpisode(token!, episode!.id, answers),
    onSuccess: (result) => {
      setCompletion(result);
      void queryClient.invalidateQueries({ queryKey: [...GAME_QUERY_KEY, token] });
      void queryClient.invalidateQueries({ queryKey: ["loyalty", token] });
    },
  });

  const startEpisode = (selected: GameEpisode) => {
    setSelectedEpisodeId(selected.id);
    setQuestionIndex(0);
    setAnswers([]);
    setSelectedOptionId(null);
    setAnswerFeedback(null);
    setAnswerCorrect(false);
    setCompletion(null);
    answerMutation.reset();
    completionMutation.reset();
  };

  const returnToEpisodes = () => {
    setSelectedEpisodeId(null);
    setQuestionIndex(0);
    setAnswers([]);
    setSelectedOptionId(null);
    setAnswerFeedback(null);
    setAnswerCorrect(false);
    setCompletion(null);
    answerMutation.reset();
    completionMutation.reset();
  };

  const continueEpisode = () => {
    if (!episode) return;
    if (questionIndex < episode.questions.length - 1) {
      setQuestionIndex((current) => current + 1);
      setSelectedOptionId(null);
      setAnswerFeedback(null);
      setAnswerCorrect(false);
      answerMutation.reset();
      return;
    }
    completionMutation.mutate();
  };

  return (
    <AppShell active="/game">
      <PageTitle
        eyebrow="ИГРА ДЛЯ КЛИЕНТОВ"
        title="Заявка с секретом"
        description="Помогите еноту-мастеру разобраться в компьютерной технике: задайте правильные вопросы и выберите безопасные действия."
      />

      {user?.role !== "CUSTOMER" ? (
        <SectionCard className="max-w-2xl">
          <p className="font-medium">Игра доступна клиентам сервиса.</p>
        </SectionCard>
      ) : episodesQuery.isLoading ? (
        <SectionCard className="max-w-2xl text-sm text-slate-500">Загружаем задания…</SectionCard>
      ) : episodesQuery.isError ? (
        <SectionCard className="max-w-2xl">
          <p className="font-medium">Не удалось загрузить игру.</p>
          <button
            onClick={() => void episodesQuery.refetch()}
            className="mt-3 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Повторить
          </button>
        </SectionCard>
      ) : !selectedEpisodeId ? (
        <div className="grid max-w-5xl gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
          <section className="grid gap-4" aria-label="Игровые сценарии">
            {episodesQuery.data?.episodes.map((item) => (
              <SectionCard
                key={item.id}
                className="flex flex-col gap-4 sm:flex-row sm:items-center"
              >
                <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/70 dark:text-blue-300">
                  <Gamepad2 size={27} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{item.title}</h2>
                    {item.completed && (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Пройдено
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-500">{item.introduction}</p>
                  <p className="mt-2 text-xs text-slate-400">
                    {item.questions.length} вопроса · {episodesQuery.data?.pointsPerEpisode}{" "}
                    бонусных баллов за первое прохождение
                  </p>
                </div>
                <button
                  disabled={item.completed}
                  onClick={() => startEpisode(item)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600 dark:disabled:bg-slate-700 dark:disabled:text-slate-300"
                >
                  {item.completed ? "Уже пройдено" : "Играть"}
                  {!item.completed && <ArrowRight size={17} />}
                </button>
              </SectionCard>
            ))}
            {episodesQuery.data?.episodes.length === 0 && (
              <SectionCard>
                <p className="font-medium">Новые задания уже в пути.</p>
                <p className="mt-2 text-sm text-slate-500">
                  Загляните сюда позже — енот готовит новые истории.
                </p>
              </SectionCard>
            )}
          </section>

          <aside className="h-fit rounded-2xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/60 dark:bg-amber-950/30">
            <div className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
              <Star size={18} fill="currentColor" />
              Ваши игровые бонусы
            </div>
            <p className="mt-3 text-sm text-amber-900/80 dark:text-amber-100/80">
              Баланс: <strong>{episodesQuery.data?.balance ?? 0}</strong> баллов
            </p>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
              На этой неделе:{" "}
              <strong>
                {episodesQuery.data?.weeklyAwardedPoints ?? 0} из{" "}
                {episodesQuery.data?.weeklyLimit ?? 50}
              </strong>
            </p>
            <p className="mt-3 text-xs leading-5 text-amber-900/70 dark:text-amber-100/70">
              За первое правильное прохождение сценария начисляется{" "}
              {episodesQuery.data?.pointsPerEpisode ?? 10} баллов. За одну неделю можно получить не
              больше {episodesQuery.data?.weeklyLimit ?? 50}. Повторное прохождение не начисляет
              баллы.
            </p>
            <Link
              to="/loyalty"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-amber-900 underline dark:text-amber-200"
            >
              История бонусов <ArrowRight size={15} />
            </Link>
          </aside>
        </div>
      ) : episode && completion ? (
        <SectionCard className="mx-auto max-w-3xl overflow-hidden border-blue-200 bg-gradient-to-br from-blue-50 to-white dark:border-blue-900 dark:from-blue-950/50 dark:to-slate-900">
          <div className="grid items-center gap-5 sm:grid-cols-[220px_1fr]">
            <div className="overflow-hidden rounded-2xl bg-sky-200">
              <img
                key={`complete-${completion.awardedPoints}`}
                src="/game/raccoon-happy.png"
                alt="Енот-мастер улыбается и хлопает в ладоши"
                className="game-raccoon-happy aspect-square w-full object-cover"
              />
            </div>
            <div>
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                <Check size={17} /> Сценарий пройден
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Отличная работа!</h2>
              {completion.awardedPoints > 0 ? (
                <p className="mt-3 text-lg font-semibold text-emerald-700 dark:text-emerald-300">
                  +{completion.awardedPoints} бонусных баллов
                </p>
              ) : completion.alreadyCompleted ? (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Этот сценарий уже был пройден — повторные награды не начисляются.
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                  Недельный лимит в {episodesQuery.data?.weeklyLimit ?? 50} баллов уже достигнут;
                  сценарий завершён без дополнительной награды.
                </p>
              )}
              <p className="mt-2 text-sm text-slate-500">
                Текущий бонусный баланс: {completion.balance} баллов.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  onClick={returnToEpisodes}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-4 font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                >
                  <ArrowLeft size={16} /> К заданиям
                </button>
                <Link
                  to="/orders"
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700"
                >
                  Создать заявку <ArrowRight size={16} />
                </Link>
              </div>
            </div>
          </div>
        </SectionCard>
      ) : episode && question ? (
        <section className="mx-auto max-w-5xl" aria-label={episode.title}>
          <button
            onClick={returnToEpisodes}
            className="mb-4 inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <ArrowLeft size={16} /> Все задания
          </button>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_290px]">
            <SectionCard className="overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-blue-300">
                    Заявка с секретом
                  </p>
                  <h2 className="mt-1 text-lg font-semibold">{episode.title}</h2>
                </div>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  Вопрос {questionIndex + 1} из {episode.questions.length}
                </span>
              </div>
              <div className="mt-6 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div
                  className="h-full rounded-full bg-blue-600 transition-[width] duration-300"
                  style={{ width: `${((questionIndex + 1) / episode.questions.length) * 100}%` }}
                />
              </div>
              <h3 className="mt-7 text-xl leading-8 font-semibold">{question.prompt}</h3>
              <div className="mt-5 grid gap-3">
                {question.options.map((option, index) => {
                  const isSelected = selectedOptionId === option.id;
                  return (
                    <button
                      key={option.id}
                      disabled={answerMutation.isPending || answerCorrect}
                      onClick={() => {
                        setSelectedOptionId(option.id);
                        setAnswerFeedback(null);
                        setAnswerCorrect(false);
                        answerMutation.mutate({
                          episode,
                          questionId: question.id,
                          optionId: option.id,
                        });
                      }}
                      className={`flex min-h-14 items-center gap-3 rounded-xl border p-4 text-left text-sm leading-6 transition ${isSelected && answerCorrect ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" : isSelected && answerFeedback ? "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100" : "border-slate-200 hover:border-blue-300 hover:bg-blue-50/60 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"} disabled:cursor-default`}
                    >
                      <span
                        className={`grid size-8 shrink-0 place-items-center rounded-lg text-xs font-bold ${isSelected && answerCorrect ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                      >
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1">{option.text}</span>
                      {isSelected && answerCorrect && (
                        <Check size={18} className="shrink-0 text-emerald-600" />
                      )}
                    </button>
                  );
                })}
              </div>
              {answerMutation.isPending && (
                <p className="mt-4 text-sm text-slate-500">Енот проверяет ответ…</p>
              )}
              {answerMutation.isError && (
                <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">
                  Не удалось проверить ответ. Попробуйте ещё раз.
                </p>
              )}
              {answerFeedback && (
                <p
                  role="status"
                  aria-live="polite"
                  className={`mt-5 rounded-xl p-4 text-sm leading-6 ${answerCorrect ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-100" : "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-100"}`}
                >
                  {answerFeedback}
                  {!answerCorrect && (
                    <span className="mt-1 block font-semibold">
                      Ответ неверный — попробуйте ещё раз.
                    </span>
                  )}
                </p>
              )}
              {answerCorrect && (
                <button
                  onClick={continueEpisode}
                  disabled={completionMutation.isPending}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                >
                  {completionMutation.isPending
                    ? "Сохраняем прохождение…"
                    : questionIndex === episode.questions.length - 1
                      ? "Завершить сценарий"
                      : "Дальше"}
                  {!completionMutation.isPending && <ArrowRight size={16} />}
                </button>
              )}
              {completionMutation.isError && (
                <p role="alert" className="mt-4 text-sm text-rose-700 dark:text-rose-300">
                  Не удалось завершить сценарий. Проверьте подключение и повторите попытку.
                </p>
              )}
            </SectionCard>

            <aside className="grid content-start gap-4">
              <div className="overflow-hidden rounded-2xl border border-sky-200 bg-sky-200 dark:border-sky-900">
                <img
                  key={`${feedbackKey}-${answerCorrect ? "happy" : "sad"}`}
                  src={
                    answerFeedback && !answerCorrect
                      ? "/game/raccoon-sad.png"
                      : "/game/raccoon-happy.png"
                  }
                  alt={
                    answerFeedback
                      ? answerCorrect
                        ? "Енот улыбается и хлопает в ладоши"
                        : "Енот огорчён неверным ответом"
                      : "Енот-мастер ждёт ваш ответ"
                  }
                  className={`aspect-square w-full object-cover ${answerFeedback ? (answerCorrect ? "game-raccoon-happy" : "game-raccoon-wrong") : ""}`}
                />
                <p className="bg-slate-950/90 p-4 text-sm leading-6 text-white" aria-live="polite">
                  {answerFeedback
                    ? answerCorrect
                      ? "Правильно! Енот радостно хлопает."
                      : "Хмуро посмотрел: ответ неверный. Подумайте ещё раз!"
                    : "Выберите ответ. Енот готов подсказать."}
                </p>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/40">
                <div className="flex items-center gap-2 font-semibold text-blue-900 dark:text-blue-200">
                  <Sparkles size={17} /> Безопасная игра
                </div>
                <p className="mt-2 text-sm leading-6 text-blue-900/80 dark:text-blue-100/80">
                  Игра учит правильно описать симптомы. Она не заменяет диагностику мастера и не
                  просит пароли или платёжные данные.
                </p>
              </div>
            </aside>
          </div>
        </section>
      ) : null}
    </AppShell>
  );
};
