import { type FormEvent, useState } from "react";

import { type CreateCustomerOfferInput, type CustomerOfferType } from "@/lib/api";

const quizTitle = "Квиз ЕНОТА: не перегревай ноутбук";
const quizContent =
  "Ответьте один раз. После завершения срока среди участников с правильным ответом случайно выберем до трёх победителей. Перед публикацией укажите призы или баллы и срок участия.";
const starterQuestion =
  "Как лучше поставить ноутбук, чтобы его система охлаждения работала нормально?";
const starterOptions = [
  "На мягкую поверхность, например плед",
  "На ровную твёрдую поверхность, не закрывая вентиляционные отверстия",
  "Плотно придвинуть вентиляционную решётку к стене",
  "Накрыть ноутбук тканью во время работы",
];

const RewardFields = ({
  place,
  prizeName,
  pointsName,
}: {
  place: number;
  prizeName: string;
  pointsName: string;
}) => (
  <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
    <legend className="px-1 text-sm font-semibold">{place}-е место</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Приз
        <input
          name={prizeName}
          maxLength={500}
          placeholder="Например, аксессуар или сертификат"
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
          defaultValue={0}
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
    </div>
  </fieldset>
);

const rewardFieldNames = [
  ["firstPlacePrize", "firstPlacePoints"],
  ["secondPlacePrize", "secondPlacePoints"],
  ["thirdPlacePrize", "thirdPlacePoints"],
] as const;
const rewardPlaces = [
  { place: 1, prizeName: "firstPlacePrize", pointsName: "firstPlacePoints" },
  { place: 2, prizeName: "secondPlacePrize", pointsName: "secondPlacePoints" },
  { place: 3, prizeName: "thirdPlacePrize", pointsName: "thirdPlacePoints" },
];

export const CustomerOfferCreateForm = ({
  saving,
  error,
  notice,
  onCreate,
}: {
  saving: boolean;
  error: string;
  notice: string;
  onCreate: (input: CreateCustomerOfferInput, clear: () => void) => void;
}) => {
  const [type, setType] = useState<CustomerOfferType>("QUIZ");
  const [title, setTitle] = useState(quizTitle);
  const [content, setContent] = useState(quizContent);
  const [question, setQuestion] = useState(starterQuestion);
  const [options, setOptions] = useState(starterOptions);
  const [correctOption, setCorrectOption] = useState(1);
  const [validationError, setValidationError] = useState("");
  const hasPrizes = type === "GIVEAWAY" || type === "QUIZ";

  const clear = () => {
    setType("QUIZ");
    setTitle(quizTitle);
    setContent(quizContent);
    setQuestion(starterQuestion);
    setOptions(starterOptions);
    setCorrectOption(1);
    setValidationError("");
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setValidationError("");
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const startsAt = String(form.get("startsAt") ?? "");
    const endsAt = String(form.get("endsAt") ?? "");
    if (!startsAt || !endsAt || new Date(endsAt) <= new Date(startsAt)) {
      setValidationError("Укажите срок окончания позже срока начала.");
      return;
    }

    const prizes = rewardFieldNames.map(([prizeName, pointsName]) => {
      const prize = String(form.get(prizeName) ?? "").trim() || null;
      const points = Number(form.get(pointsName) ?? 0);
      return { prize, points };
    });
    if (hasPrizes && prizes.some(({ prize, points }) => !prize && points <= 0)) {
      setValidationError("Для каждого места укажите приз или количество баллов.");
      return;
    }

    const selectedOptionValue = form.get("quizCorrectOption");
    const selectedOption = selectedOptionValue === null ? -1 : Number(selectedOptionValue);
    if (
      type === "QUIZ" &&
      (question.trim().length < 3 || options.length < 2 || !Number.isInteger(selectedOption))
    ) {
      setValidationError("Проверьте вопрос и отметьте правильный вариант ответа.");
      return;
    }

    onCreate(
      {
        type,
        title: title.trim(),
        content: content.trim(),
        quizQuestion: type === "QUIZ" ? question.trim() : null,
        quizOptions: type === "QUIZ" ? options.map((option) => option.trim()) : [],
        quizCorrectOption: type === "QUIZ" ? selectedOption : null,
        firstPlacePrize: hasPrizes ? prizes[0]!.prize : null,
        firstPlacePoints: hasPrizes ? prizes[0]!.points : 0,
        secondPlacePrize: hasPrizes ? prizes[1]!.prize : null,
        secondPlacePoints: hasPrizes ? prizes[1]!.points : 0,
        thirdPlacePrize: hasPrizes ? prizes[2]!.prize : null,
        thirdPlacePoints: hasPrizes ? prizes[2]!.points : 0,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        isPublished: form.get("isPublished") === "on",
      },
      clear,
    );
  };

  return (
    <form onSubmit={submit} className="mt-5 grid gap-4">
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Тип предложения</legend>
        <div className="flex flex-wrap gap-3">
          {(
            [
              ["QUIZ", "Квиз"],
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
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          required
          minLength={2}
          maxLength={160}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Описание и условия участия
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          required
          minLength={1}
          maxLength={8000}
          rows={4}
          className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
        />
      </label>

      {type === "QUIZ" && (
        <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold">Вопрос и варианты ответа</legend>
          <label className="grid gap-1.5 text-sm font-medium">
            Вопрос
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value.slice(0, 1000))}
              required
              minLength={3}
              rows={2}
              className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <p className="text-xs text-slate-500">
            Отметьте правильный вариант — клиентам он будет показан только после публикации итогов.
            На аккаунт разрешён один ответ.
          </p>
          {options.map((option, index) => (
            <div
              key={index}
              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <label className="grid gap-1.5 text-sm font-medium">
                Вариант {index + 1}
                <input
                  value={option}
                  onChange={(event) =>
                    setOptions((current) =>
                      current.map((value, itemIndex) =>
                        itemIndex === index ? event.target.value.slice(0, 120) : value,
                      ),
                    )
                  }
                  required
                  maxLength={120}
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
              <label className="inline-flex min-h-10 items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="quizCorrectOption"
                  value={index}
                  checked={correctOption === index}
                  onChange={() => setCorrectOption(index)}
                  required
                  className="size-4 accent-blue-600"
                />
                Правильный
              </label>
            </div>
          ))}
        </fieldset>
      )}

      {hasPrizes && (
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Награды по местам</h3>
          <p className="text-xs leading-5 text-slate-500">
            Для каждого места задайте приз, баллы или оба варианта. Для квиза победители выбираются
            случайно только среди правильно ответивших; мест может быть меньше трёх.
          </p>
          {rewardPlaces.map((reward) => (
            <RewardFields key={reward.place} {...reward} />
          ))}
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
      {(error || validationError || notice) && (
        <p
          role={error || validationError ? "alert" : "status"}
          className={`text-sm ${error || validationError ? "text-rose-600" : "text-emerald-700 dark:text-emerald-300"}`}
        >
          {error || validationError || notice}
        </p>
      )}
      <button
        type="submit"
        disabled={saving}
        className="min-h-11 justify-self-start rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {saving ? "Сохраняем…" : "Сохранить предложение"}
      </button>
    </form>
  );
};
