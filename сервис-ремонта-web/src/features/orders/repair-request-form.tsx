import { type FormEvent, useState } from "react";

import { PreVisitPriceGuide } from "@/features/orders/pre-visit-price-guide";
import { RepairRequestVisitFields } from "@/features/orders/repair-request-visit-fields";
import { RepairSymptomGuide } from "@/features/orders/repair-symptom-guide";

import type { CustomerDevice, CustomerServicePrice, RepairLocation, createOrder } from "@/lib/api";

type RepairRequestInput = Parameters<typeof createOrder>[1];

type RepairRequestFormProps = {
  defaultPhone: string;
  isPending: boolean;
  isError: boolean;
  devices: CustomerDevice[];
  devicesLoading: boolean;
  servicePrices: CustomerServicePrice[];
  pricesLoading: boolean;
  pricesError: boolean;
  initialDeviceId?: string;
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
  devices,
  devicesLoading,
  servicePrices,
  pricesLoading,
  pricesError,
  initialDeviceId,
  onSubmit,
}: RepairRequestFormProps) => {
  const [photo, setPhoto] = useState<File | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState(initialDeviceId ?? "");
  const [problem, setProblem] = useState("");
  const [deviceType, setDeviceType] = useState("COMPUTER");
  const [repairLocation, setRepairLocation] = useState<RepairLocation>("SERVICE_CENTER");
  const [isWithinCity, setIsWithinCity] = useState(true);
  const selectedDevice = devices.find((device) => device.id === selectedDeviceId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const requestedAt = String(data.get("preferredAt") || "");
    onSubmit(
      {
        deviceType: String(data.get("deviceType")),
        ...(selectedDeviceId ? { customerDeviceId: selectedDeviceId } : {}),
        deviceBrand: String(data.get("deviceBrand") || "").trim(),
        deviceModel: String(data.get("deviceModel") || "").trim(),
        deviceSerialNumber: String(data.get("deviceSerialNumber") || "").trim(),
        problem: String(data.get("problem")),
        contactPhone: String(data.get("contactPhone")),
        repairLocation,
        useNewRepairScenario: true,
        ...(repairLocation === "CUSTOMER_ADDRESS"
          ? {
              visitIsWithinCity: isWithinCity,
              ...(!isWithinCity
                ? { visitCustomerDistanceKm: Number(data.get("visitCustomerDistanceKm")) }
                : {}),
            }
          : {}),
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
          value={selectedDevice?.deviceType ?? deviceType}
          onChange={(event) => setDeviceType(event.target.value)}
          disabled={Boolean(selectedDevice)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="COMPUTER">ПК</option>
          <option value="LAPTOP">Ноутбук</option>
          <option value="PHONE">Телефон</option>
          <option value="TABLET">Планшет</option>
        </select>
      </label>
      {selectedDevice && (
        <input type="hidden" name="deviceType" value={selectedDevice.deviceType} />
      )}
      {devices.length > 0 && (
        <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
          Сохранённая техника
          <select
            value={selectedDeviceId}
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Новая техника — заполнить вручную</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {[device.nickname, device.brand, device.model].filter(Boolean).join(" · ") ||
                  "Моя техника"}
              </option>
            ))}
          </select>
          {selectedDevice && (
            <span className="font-normal text-slate-500">
              Заявка будет связана с этой техникой и появится в её истории ремонта.
            </span>
          )}
        </label>
      )}
      {selectedDeviceId && !selectedDevice && !devicesLoading && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 md:col-span-2 dark:bg-amber-950/40 dark:text-amber-100">
          Сохранённая техника не найдена. Выберите ручной ввод и заполните данные устройства.
          <button
            type="button"
            onClick={() => setSelectedDeviceId("")}
            className="ml-2 font-semibold underline"
          >
            Ввести вручную
          </button>
        </div>
      )}
      {!selectedDevice && (
        <>
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
          <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
            Серийный номер (если известен)
            <input
              name="deviceSerialNumber"
              maxLength={160}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </>
      )}
      <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
        Опишите неисправность
        <textarea
          name="problem"
          minLength={5}
          maxLength={2000}
          required
          rows={3}
          value={problem}
          onChange={(event) => setProblem(event.target.value)}
          className="rounded-xl border border-slate-200 bg-white p-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <div className="md:col-span-2">
        <RepairSymptomGuide
          deviceType={selectedDevice?.deviceType ?? deviceType}
          onChoose={(summary) =>
            setProblem((current) => (current ? `${current}\n${summary}` : summary))
          }
        />
      </div>
      <RepairRequestVisitFields
        repairLocation={repairLocation}
        onRepairLocationChange={setRepairLocation}
        isWithinCity={isWithinCity}
        onWithinCityChange={setIsWithinCity}
      />
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
        Город {repairLocation === "CUSTOMER_ADDRESS" ? "для выезда" : "(необязательно)"}
        <input
          name="city"
          maxLength={120}
          required={repairLocation === "CUSTOMER_ADDRESS"}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Улица {repairLocation === "CUSTOMER_ADDRESS" ? "для выезда" : "(необязательно)"}
        <input
          name="street"
          maxLength={180}
          required={repairLocation === "CUSTOMER_ADDRESS"}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Дом {repairLocation === "CUSTOMER_ADDRESS" ? "для выезда" : "(необязательно)"}
        <input
          name="house"
          maxLength={30}
          required={repairLocation === "CUSTOMER_ADDRESS"}
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
      <div className="md:col-span-2">
        <PreVisitPriceGuide
          prices={servicePrices}
          deviceType={selectedDevice?.deviceType ?? deviceType}
          isLoading={pricesLoading}
          isError={pricesError}
        />
      </div>
      <div className="md:col-span-2">
        <button
          disabled={isPending || devicesLoading || Boolean(selectedDeviceId && !selectedDevice)}
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
