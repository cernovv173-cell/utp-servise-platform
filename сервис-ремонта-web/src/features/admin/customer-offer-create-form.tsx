import { type FormEvent, useState } from "react";

import { type CreateCustomerOfferInput, type CustomerOfferType } from "@/lib/api";

import { CustomerOfferPrizePhotoField } from "./customer-offer-prize-photo-field";

const RewardFields = ({
  place,
  prizeName,
  pointsName,
  imageFile,
  inputKey,
  disabled,
  onImageChange,
}: {
  place: number;
  prizeName: string;
  pointsName: string;
  imageFile: File | null;
  inputKey: number;
  disabled: boolean;
  onImageChange: (file: File | null) => void;
}) => (
  <fieldset className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
    <legend className="px-1 text-sm font-semibold">{place}-е место</legend>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Приз (необязательно)
        <input
          name={prizeName}
          maxLength={500}
          placeholder="Например, аксессуар или сертификат"
          className="h-10 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Баллы (необязательно)
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
    <CustomerOfferPrizePhotoField
      place={place}
      file={imageFile}
      inputKey={inputKey}
      disabled={disabled}
      onChange={onImageChange}
    />
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
  onCreate: (
    input: CreateCustomerOfferInput,
    prizeImages: (File | null)[],
    clear: () => void,
  ) => void;
}) => {
  const [type, setType] = useState<CustomerOfferType>("PROMOTION");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [validationError, setValidationError] = useState("");
  const [prizeImages, setPrizeImages] = useState<(File | null)[]>([null, null, null]);
  const [photoInputKey, setPhotoInputKey] = useState(0);
  const hasPrizes = type === "GIVEAWAY";

  const clear = () => {
    setType("PROMOTION");
    setTitle("");
    setContent("");
    setPrizeImages([null, null, null]);
    setPhotoInputKey((current) => current + 1);
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
    const configuredPlaces = prizes.map(({ prize, points }) => Boolean(prize) || points > 0);
    if (hasPrizes && (!configuredPlaces[0] || (configuredPlaces[2] && !configuredPlaces[1]))) {
      setValidationError(
        "Укажите награду для 1-го места; 2-е и 3-е можно оставить пустыми, но места заполняются по порядку.",
      );
      return;
    }
    if (
      hasPrizes &&
      prizeImages.some(
        (file) =>
          file &&
          (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(file.type) ||
            file.size > 5 * 1024 * 1024),
      )
    ) {
      setValidationError("Выберите фото JPG, PNG или WebP размером не более 5 МБ.");
      return;
    }

    onCreate(
      {
        type,
        title: title.trim(),
        content: content.trim(),
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
      hasPrizes ? prizeImages : [null, null, null],
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

      {hasPrizes && (
        <div className="grid gap-3">
          <h3 className="text-sm font-semibold">Награды по местам</h3>
          <p className="text-xs leading-5 text-slate-500">
            Укажите приз и/или баллы для 1-го места. 2-е и 3-е места можно не заполнять; если
            добавляете 3-е, заполните и 2-е. Фото приза необязательно.
          </p>
          {rewardPlaces.map((reward) => (
            <RewardFields
              key={reward.place}
              {...reward}
              imageFile={prizeImages[reward.place - 1] ?? null}
              inputKey={photoInputKey}
              disabled={saving}
              onImageChange={(file) =>
                setPrizeImages((current) =>
                  current.map((value, index) => (index === reward.place - 1 ? file : value)),
                )
              }
            />
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
