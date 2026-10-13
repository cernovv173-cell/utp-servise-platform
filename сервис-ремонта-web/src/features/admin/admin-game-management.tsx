import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Plus, Save, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";
import { useState } from "react";

import { PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import {
  type GameAdminEpisodeInput,
  type GameAdminQuestionInput,
  createAdminGameEpisode,
  getAdminGameEpisodes,
  updateAdminGameEpisode,
} from "@/features/game/game-api";

const emptyQuestion = (): GameAdminQuestionInput => ({
  prompt: "",
  correctFeedback: "Верно! Это безопасное решение.",
  incorrectFeedback: "Не совсем. Подумайте о безопасном следующем шаге.",
  options: [
    { text: "", isCorrect: true },
    { text: "", isCorrect: false },
  ],
});

const inputClassName =
  "min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950 dark:focus:ring-blue-900";

export const AdminGameManagement = () => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<GameAdminEpisodeInput>({
    title: "",
    introduction: "",
    isActive: true,
    questions: [emptyQuestion()],
  });

  const query = useQuery({
    queryKey: ["admin-game-episodes", token],
    queryFn: ({ signal }) => getAdminGameEpisodes(token!, signal),
    enabled: Boolean(token),
  });

  const saveMutation = useMutation({
    mutationFn: () => createAdminGameEpisode(token!, draft),
    onSuccess: () => {
      setDraft({ title: "", introduction: "", isActive: true, questions: [emptyQuestion()] });
      void queryClient.invalidateQueries({ queryKey: ["admin-game-episodes", token] });
      void queryClient.invalidateQueries({ queryKey: ["game-episodes", token] });
    },
  });

  const activationMutation = useMutation({
    mutationFn: ({ episodeId, isActive }: { episodeId: string; isActive: boolean }) =>
      updateAdminGameEpisode(token!, episodeId, { isActive }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-game-episodes", token] });
      void queryClient.invalidateQueries({ queryKey: ["game-episodes", token] });
    },
  });

  const setQuestion = (questionIndex: number, update: Partial<GameAdminQuestionInput>) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, index) =>
        index === questionIndex ? { ...question, ...update } : question,
      ),
    }));
  };

  const setOption = (
    questionIndex: number,
    optionIndex: number,
    update: Partial<GameAdminQuestionInput["options"][number]>,
  ) => {
    setDraft((current) => ({
      ...current,
      questions: current.questions.map((question, currentQuestionIndex) =>
        currentQuestionIndex === questionIndex
          ? {
              ...question,
              options: question.options.map((option, currentOptionIndex) =>
                currentOptionIndex === optionIndex ? { ...option, ...update } : option,
              ),
            }
          : question,
      ),
    }));
  };

  return (
    <>
      <PageTitle
        eyebrow="АДМИНИСТРИРОВАНИЕ"
        title="Вопросы для игры"
        description="Создавайте новые игровые сценарии для компьютерной техники. Для каждого вопроса задайте варианты, отметьте один правильный ответ и объясните оба результата."
      />

      <div className="grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            saveMutation.mutate();
          }}
          className="grid gap-5"
        >
          <SectionCard className="grid gap-4">
            <h2 className="text-lg font-semibold">Новый сценарий</h2>
            <label className="grid gap-2 text-sm font-medium">
              Название
              <input
                required
                maxLength={120}
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, title: event.target.value }))
                }
                className={inputClassName}
                placeholder="Например, ноутбук стал перегреваться"
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Вступление для клиента
              <textarea
                required
                minLength={10}
                maxLength={1000}
                rows={3}
                value={draft.introduction}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, introduction: event.target.value }))
                }
                className={`${inputClassName} resize-y`}
                placeholder="Опишите ситуацию, с которой обращается клиент"
              />
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-xl bg-slate-50 px-3 text-sm dark:bg-slate-800">
              <input
                type="checkbox"
                checked={draft.isActive}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, isActive: event.target.checked }))
                }
                className="size-4 accent-blue-600"
              />
              Сразу показывать сценарий клиентам
            </label>
          </SectionCard>

          {draft.questions.map((question, questionIndex) => (
            <SectionCard key={questionIndex} className="grid gap-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Вопрос {questionIndex + 1}</h3>
                {draft.questions.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Удалить вопрос ${questionIndex + 1}`}
                    onClick={() =>
                      setDraft((current) => ({
                        ...current,
                        questions: current.questions.filter((_, index) => index !== questionIndex),
                      }))
                    }
                    className="grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 size={17} />
                  </button>
                )}
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Текст вопроса
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  value={question.prompt}
                  onChange={(event) => setQuestion(questionIndex, { prompt: event.target.value })}
                  className={`${inputClassName} resize-y`}
                  placeholder="Какой следующий шаг будет безопасным?"
                />
              </label>
              <fieldset className="grid gap-3">
                <legend className="text-sm font-medium">
                  Варианты ответа — отметьте ровно один правильный
                </legend>
                {question.options.map((option, optionIndex) => (
                  <div key={optionIndex} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`correct-${questionIndex}`}
                      checked={option.isCorrect}
                      onChange={() => {
                        setDraft((current) => ({
                          ...current,
                          questions: current.questions.map((item, currentQuestionIndex) =>
                            currentQuestionIndex === questionIndex
                              ? {
                                  ...item,
                                  options: item.options.map((entry, index) => ({
                                    ...entry,
                                    isCorrect: index === optionIndex,
                                  })),
                                }
                              : item,
                          ),
                        }));
                      }}
                      aria-label={`Сделать вариант ${optionIndex + 1} правильным`}
                      className="size-4 shrink-0 accent-emerald-600"
                    />
                    <input
                      required
                      minLength={2}
                      maxLength={300}
                      value={option.text}
                      onChange={(event) =>
                        setOption(questionIndex, optionIndex, { text: event.target.value })
                      }
                      className={inputClassName}
                      placeholder={`Вариант ${optionIndex + 1}`}
                    />
                    {question.options.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Удалить вариант ${optionIndex + 1}`}
                        onClick={() => {
                          const remaining = question.options.filter(
                            (_, index) => index !== optionIndex,
                          );
                          if (!remaining.some(({ isCorrect }) => isCorrect))
                            remaining[0] = { ...remaining[0]!, isCorrect: true };
                          setQuestion(questionIndex, { options: remaining });
                        }}
                        className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-500 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                {question.options.length < 5 && (
                  <button
                    type="button"
                    onClick={() =>
                      setQuestion(questionIndex, {
                        options: [...question.options, { text: "", isCorrect: false }],
                      })
                    }
                    className="inline-flex min-h-10 items-center gap-2 justify-self-start rounded-lg px-2 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-950/40"
                  >
                    <Plus size={16} /> Добавить вариант
                  </button>
                )}
              </fieldset>
              <label className="grid gap-2 text-sm font-medium">
                Сообщение при правильном ответе
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  value={question.correctFeedback}
                  onChange={(event) =>
                    setQuestion(questionIndex, { correctFeedback: event.target.value })
                  }
                  className={`${inputClassName} resize-y`}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Подсказка при неверном ответе
                <textarea
                  required
                  minLength={5}
                  maxLength={500}
                  rows={2}
                  value={question.incorrectFeedback}
                  onChange={(event) =>
                    setQuestion(questionIndex, { incorrectFeedback: event.target.value })
                  }
                  className={`${inputClassName} resize-y`}
                />
              </label>
            </SectionCard>
          ))}

          {draft.questions.length < 20 && (
            <button
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  questions: [...current.questions, emptyQuestion()],
                }))
              }
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-blue-400 px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-700 dark:text-blue-300 dark:hover:bg-blue-950/40"
            >
              <Plus size={17} /> Добавить вопрос
            </button>
          )}

          {saveMutation.isError && (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              Не удалось сохранить сценарий. Проверьте форму и попробуйте ещё раз.
            </p>
          )}
          <button
            type="submit"
            disabled={saveMutation.isPending}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            <Save size={17} /> {saveMutation.isPending ? "Сохраняем…" : "Сохранить сценарий"}
          </button>
        </form>

        <section className="grid content-start gap-4" aria-label="Сохранённые сценарии">
          <h2 className="text-lg font-semibold">Сценарии для клиентов</h2>
          {query.isError && (
            <SectionCard>
              <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
                Не удалось загрузить список игровых сценариев.
              </p>
            </SectionCard>
          )}
          {query.isLoading && (
            <SectionCard>
              <p className="text-sm text-slate-500">Загружаем сценарии…</p>
            </SectionCard>
          )}
          {query.data?.episodes.map((episode) => (
            <SectionCard key={episode.id} className="grid gap-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">{episode.title}</h3>
                  <p className="mt-1 text-xs text-slate-500">{episode.questions.length} вопросов</p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${episode.isActive ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                >
                  {episode.isActive ? "Опубликован" : "Скрыт"}
                </span>
              </div>
              <p className="text-sm leading-6 text-slate-500">{episode.introduction}</p>
              <div className="grid gap-3">
                {episode.questions.map((item, index) => (
                  <div
                    key={item.id}
                    className="rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-800/70"
                  >
                    <p className="font-medium">
                      {index + 1}. {item.prompt}
                    </p>
                    <ul className="mt-2 grid gap-1.5 text-xs text-slate-500">
                      {item.options.map((option) => (
                        <li key={option.id} className="flex items-center gap-2">
                          {option.isCorrect ? (
                            <Check size={14} className="shrink-0 text-emerald-600" />
                          ) : (
                            <span className="size-[14px] shrink-0" />
                          )}
                          {option.text}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <button
                disabled={activationMutation.isPending}
                onClick={() =>
                  activationMutation.mutate({ episodeId: episode.id, isActive: !episode.isActive })
                }
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                {episode.isActive ? (
                  <ToggleRight size={17} className="text-emerald-600" />
                ) : (
                  <ToggleLeft size={17} />
                )}
                {episode.isActive ? "Скрыть у клиентов" : "Опубликовать"}
              </button>
            </SectionCard>
          ))}
        </section>
      </div>
    </>
  );
};
