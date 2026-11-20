import { type FormEvent, useState } from "react";

import { PreVisitPriceGuide } from "@/features/orders/pre-visit-price-guide";
import {
  RepairOrderContactFields,
  RepairOrderDeviceFields,
} from "@/features/orders/repair-order-intake-fields";
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
  const [phone, setPhone] = useState(defaultPhone);
  const [repairLocation, setRepairLocation] = useState<RepairLocation>("SERVICE_CENTER");
  const [isWithinCity, setIsWithinCity] = useState(true);
  const supportedDevices = devices.filter(
    (device) =>
      device.deviceType === "COMPUTER" ||
      device.deviceType === "LAPTOP" ||
      device.deviceType === "MONOBLOCK",
  );
  const selectedDevice = supportedDevices.find((device) => device.id === selectedDeviceId);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const requestedAt = String(data.get("preferredAt") || "");
    onSubmit(
      {
        deviceType: String(data.get("deviceType")),
        ...(selectedDevice ? { customerDeviceId: selectedDevice.id } : {}),
        deviceBrand: selectedDevice?.brand ?? String(data.get("deviceBrand") || "").trim(),
        deviceModel: selectedDevice?.model ?? String(data.get("deviceModel") || "").trim(),
        deviceSerialNumber:
          selectedDevice?.serialNumber ?? String(data.get("deviceSerialNumber") || "").trim(),
        problem: problem.trim(),
        contactPhone: phone.trim(),
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
      {supportedDevices.length > 0 && (
        <label className="grid gap-1.5 text-sm font-medium md:col-span-2">
          Сохранённая техника
          <select
            value={selectedDeviceId}
            onChange={(event) => setSelectedDeviceId(event.target.value)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-900"
          >
            <option value="">Новая техника — заполнить вручную</option>
            {supportedDevices.map((device) => (
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
          Для новой заявки выберите компьютер или ноутбук и укажите его данные вручную.
          <button
            type="button"
            onClick={() => setSelectedDeviceId("")}
            className="ml-2 font-semibold underline"
          >
            Ввести вручную
          </button>
        </div>
      )}
      <RepairOrderDeviceFields
        deviceType={selectedDevice?.deviceType ?? deviceType}
        onDeviceTypeChange={setDeviceType}
        deviceTypeLocked={Boolean(selectedDevice)}
        showDeviceDetails={!selectedDevice}
        problem={problem}
        onProblemChange={setProblem}
      />
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
      <RepairOrderContactFields
        phone={phone}
        onPhoneChange={setPhone}
        repairLocation={repairLocation}
      />
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
