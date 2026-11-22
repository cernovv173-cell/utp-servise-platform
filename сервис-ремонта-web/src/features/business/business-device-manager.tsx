import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";

import { SectionCard } from "@/components/app-shell";

import { repairDeviceTypes } from "@/features/catalog/catalog-model";

import type { CustomerDevice, CustomerDeviceInput } from "@/lib/api";

const deviceLabels: Record<string, string> = {
  COMPUTER: "Стационарный компьютер",
  LAPTOP: "Ноутбук",
  MONOBLOCK: "Моноблок",
};

export const BusinessDeviceManager = ({
  devices,
  enabled,
  isLoading,
  isError,
  isAdding,
  isDeleting,
  onAdd,
  onDelete,
}: {
  devices: CustomerDevice[];
  enabled: boolean;
  isLoading: boolean;
  isError: boolean;
  isAdding: boolean;
  isDeleting: boolean;
  onAdd: (input: CustomerDeviceInput) => Promise<unknown>;
  onDelete: (deviceId: string) => void;
}) => {
  const [deviceType, setDeviceType] = useState("COMPUTER");
  const [nickname, setNickname] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await onAdd({
        deviceType,
        nickname: nickname.trim() || null,
        brand: brand.trim() || null,
        model: model.trim() || null,
        serialNumber: serialNumber.trim() || null,
        scope: "business",
      });
      setNickname("");
      setBrand("");
      setModel("");
      setSerialNumber("");
    } catch {
      // The owning page reports mutation failures.
    }
  };

  const inputClass =
    "min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950";

  return (
    <div className="grid gap-4">
      <SectionCard>
        <div className="mb-4">
          <h2 className="font-semibold">Техника компании</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Список отделён от вашей личной техники. Новые заявки можно быстро создать из карточки
            устройства.
          </p>
        </div>
        {!enabled ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
            Сначала сохраните название компании, чтобы вести её устройства отдельно.
          </p>
        ) : (
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
              Тип техники&nbsp;*
              <select
                required
                value={deviceType}
                onChange={(event) => setDeviceType(event.target.value)}
                className={inputClass}
              >
                {repairDeviceTypes.map((type) => (
                  <option key={type} value={type}>
                    {deviceLabels[type] ?? type}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Название для списка
              <input
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                maxLength={120}
                placeholder="Например, ноутбук бухгалтера"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Марка
              <input
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
                maxLength={120}
                placeholder="Например, Lenovo"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Модель
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                maxLength={160}
                className={inputClass}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Серийный номер
              <input
                value={serialNumber}
                onChange={(event) => setSerialNumber(event.target.value)}
                maxLength={160}
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={isAdding}
              className="min-h-10 justify-self-start rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 sm:col-span-2"
            >
              {isAdding ? "Добавляем…" : "+ Добавить устройство"}
            </button>
          </form>
        )}
      </SectionCard>

      {isLoading && <p className="text-sm text-slate-500">Загружаем технику компании…</p>}
      {isError && (
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить список устройств. Обновите страницу и попробуйте снова.
        </p>
      )}
      {!isLoading && !isError && enabled && devices.length === 0 && (
        <SectionCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Пока нет техники компании. Добавьте устройство выше, чтобы начать историю обслуживания.
          </p>
        </SectionCard>
      )}
      {devices.map((device) => (
        <SectionCard key={device.id}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold tracking-wide text-blue-600 uppercase dark:text-cyan-300">
                {deviceLabels[device.deviceType] ?? device.deviceType}
              </p>
              <h3 className="mt-1 text-lg font-semibold">
                {device.nickname ||
                  [device.brand, device.model].filter(Boolean).join(" ") ||
                  "Без названия"}
              </h3>
              {(device.brand || device.model || device.serialNumber) && (
                <p className="mt-1 text-sm break-words text-slate-500 dark:text-slate-400">
                  {[
                    device.brand,
                    device.model,
                    device.serialNumber && `сер. № ${device.serialNumber}`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={isDeleting}
              onClick={() => {
                if (
                  window.confirm(
                    "Удалить устройство из корпоративного списка? Заявки и документы сохранятся.",
                  )
                ) {
                  onDelete(device.id);
                }
              }}
              className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Удалить из списка
            </button>
          </div>
          <Link
            to="/orders"
            search={{ scope: "business", device: device.id }}
            className="mt-4 inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
          >
            Создать заявку на это устройство
          </Link>
        </SectionCard>
      ))}
    </div>
  );
};
