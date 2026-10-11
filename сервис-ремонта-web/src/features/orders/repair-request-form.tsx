import { type FormEvent, useState } from "react";

import type { createOrder } from "@/lib/api";

type RepairRequestInput = Parameters<typeof createOrder>[1];

type RepairRequestFormProps = {
  defaultPhone: string;
  isPending: boolean;
  isError: boolean;
  onSubmit: (input: RepairRequestInput, photo: File | null) => void;
};

const localDateTimeMinimum = () => {
  const localNow = new Date(Date.now() - new Date().getTimezoneOffset() * 60_000);
  return localNow.toISOString().slice(0, 16);
};

export const RepairRequestForm = ({
  defaultPhone,
  isPending,
  isError,
  onSubmit,
}: RepairRequestFormProps) => {
  const [photo, setPhoto] = useState<File | null>(null);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const requestedAt = String(data.get("preferredAt") || "");
    onSubmit(
      {
        deviceType: String(data.get("deviceType")),
        deviceBrand: String(data.get("deviceBrand") || "").trim(),
        deviceModel: String(data.get("deviceModel") || "").trim(),
        deviceSerialNumber: String(data.get("deviceSerialNumber") || "").trim(),
        problem: String(data.get("problem")),
        contactPhone: String(data.get("contactPhone")),
        city: String(data.get("city")),
        street: String(data.get("street")),
        house: String(data.get("house")),
        apartment: String(data.get("apartment") || ""),
        entrance: String(data.get("entrance") || ""),
        hasBarrier: data.get("hasBarrier") === "on",
        floor: String(data.get("floor") || ""),
        additionalPhone: String(data.get("additionalPhone") || ""),
        additionalInfo: String(data.get("additionalInfo") || ""),
        preferredAt: requestedAt ? new Date(requestedAt).toISOString() : null,
      },
      photo,
    );
  };

  return (
    <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
      <label className="grid gap-1.5 text-sm font-medium">
        Тип устройства
        <select
          name="deviceType"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="COMPUTER">Компьютер</option>
          <option value="LAPTOP">Ноутбук</option>
          <option value="PHONE">Телефон</option>
          <option value="TABLET">Планшет</option>
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Марка
        <input
          name="deviceBrand"
          maxLength={120}
          placeholder="Например, Lenovo"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Модель
        <input
          name="deviceModel"
          maxLength={160}
          placeholder="Например, ThinkPad T14"
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Серийный номер (если известен)
        <input
          name="deviceSerialNumber"
          maxLength={160}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
        Опишите неисправность
        <textarea
          name="problem"
          minLength={5}
          maxLength={2000}
          required
          rows={3}
          className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Телефон для связи
        <input
          name="contactPhone"
          type="tel"
          minLength={7}
          maxLength={32}
          required
          defaultValue={defaultPhone}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Город
        <input
          name="city"
          required
          minLength={2}
          maxLength={120}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Улица
        <input
          name="street"
          required
          minLength={2}
          maxLength={180}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Дом
        <input
          name="house"
          required
          maxLength={30}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Квартира
        <input
          name="apartment"
          maxLength={30}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Подъезд
        <input
          name="entrance"
          maxLength={30}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Этаж
        <input
          name="floor"
          maxLength={20}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Дополнительный телефон
        <input
          name="additionalPhone"
          type="tel"
          maxLength={32}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Удобное время для связи или выезда
        <input
          name="preferredAt"
          type="datetime-local"
          min={localDateTimeMinimum()}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <p className="self-end text-xs leading-5 text-slate-500">
        Время предварительное: сервис подтвердит его после проверки расписания.
      </p>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input type="checkbox" name="hasBarrier" className="size-4 accent-blue-600" />
        Есть шлагбаум
      </label>
      <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
        Дополнительная информация
        <textarea
          name="additionalInfo"
          maxLength={500}
          rows={2}
          className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
        Фото техники (необязательно)
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => setPhoto(event.currentTarget.files?.[0] ?? null)}
          className="block w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-900"
        />
        <span className="font-normal text-slate-500">
          {photo ? `Выбрано: ${photo.name}` : "Фото можно добавить и позже в карточке заявки."}
        </span>
      </label>
      <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 md:col-span-2 dark:bg-slate-900 dark:text-slate-300">
        Стоимость согласуется с вами. Оплата производится после завершения ремонта.
      </div>
      <div className="md:col-span-2">
        <button
          disabled={isPending}
          className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {isPending ? "Отправляем…" : "Отправить заявку"}
        </button>
        {isError && (
          <p role="alert" className="mt-2 text-sm text-rose-600">
            Не удалось отправить. Проверьте данные и повторите.
          </p>
        )}
      </div>
    </form>
  );
};
