import { MapPin } from "lucide-react";

import {
  DIAGNOSIS_FEE_RUB,
  OUT_OF_TOWN_RATE_RUB_PER_KM,
  formatRub,
} from "./scenario-preview-model";
import { PreviewChoiceButton, PreviewSummaryLine } from "./scenario-preview-ui";

type RepairLocation = "SERVICE_CENTER" | "CUSTOMER_ADDRESS";

export const ScenarioClientPanel = ({
  repairLocation,
  onRepairLocationChange,
  address,
  onAddressChange,
  isWithinPushkino,
  onWithinPushkinoChange,
  oneWayKm,
  onOneWayKmChange,
  requestCreated,
  onCreateRequest,
}: {
  repairLocation: RepairLocation;
  onRepairLocationChange: (value: RepairLocation) => void;
  address: string;
  onAddressChange: (value: string) => void;
  isWithinPushkino: boolean;
  onWithinPushkinoChange: (value: boolean) => void;
  oneWayKm: string;
  onOneWayKmChange: (value: string) => void;
  requestCreated: boolean;
  onCreateRequest: () => void;
}) => {
  const isVisit = repairLocation === "CUSTOMER_ADDRESS";
  const distanceKm = Math.max(0, Number(oneWayKm) || 0);
  const travelEstimate =
    isVisit && !isWithinPushkino ? distanceKm * OUT_OF_TOWN_RATE_RUB_PER_KM : 0;

  return (
    <div className="grid gap-5">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-semibold">Как передать технику?</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Данные примерные. Здесь можно проверить выбор и расчёт.
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <PreviewChoiceButton
          active={!isVisit}
          onClick={() => onRepairLocationChange("SERVICE_CENTER")}
        >
          Привезу в сервис
        </PreviewChoiceButton>
        <PreviewChoiceButton
          active={isVisit}
          onClick={() => onRepairLocationChange("CUSTOMER_ADDRESS")}
        >
          Вызвать мастера
        </PreviewChoiceButton>
      </div>

      {isVisit && (
        <div className="grid gap-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
          <div className="flex items-start gap-3">
            <MapPin
              className="mt-0.5 size-5 shrink-0 text-blue-600 dark:text-sky-300"
              aria-hidden="true"
            />
            <div>
              <h3 className="font-semibold">Адрес выезда</h3>
              <p className="mt-1 text-sm leading-5 text-slate-500 dark:text-slate-400">
                Пушкино, Московская область
              </p>
            </div>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Улица и дом
            <input
              value={address}
              onChange={(event) => onAddressChange(event.target.value)}
              placeholder="Введите адрес"
              maxLength={240}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <PreviewChoiceButton
              active={isWithinPushkino}
              onClick={() => onWithinPushkinoChange(true)}
            >
              В Пушкино
            </PreviewChoiceButton>
            <PreviewChoiceButton
              active={!isWithinPushkino}
              onClick={() => onWithinPushkinoChange(false)}
            >
              За городом
            </PreviewChoiceButton>
          </div>
          {!isWithinPushkino && (
            <label className="grid max-w-xs gap-1.5 text-sm font-medium">
              Примерно от границы Пушкино, в одну сторону (км)
              <input
                type="number"
                min="0"
                step="1"
                value={oneWayKm}
                onChange={(event) => onOneWayKmChange(event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          )}
          <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
            Километраж клиент указывает вручную. Перед подтверждением мастер или администратор
            сверит расстояние по Яндекс Картам; подключения к картам в макете нет.
          </p>
        </div>
      )}

      <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-4 dark:border-blue-900 dark:bg-blue-950/40">
        <h3 className="font-semibold">Предварительно по заявке</h3>
        <div className="mt-2">
          <PreviewSummaryLine
            label="Диагностика — если проведена"
            value={formatRub(DIAGNOSIS_FEE_RUB)}
          />
          {isVisit && (
            <PreviewSummaryLine
              label={
                isWithinPushkino
                  ? "Выезд в Пушкино"
                  : `Выезд: ${distanceKm} км × ${formatRub(OUT_OF_TOWN_RATE_RUB_PER_KM)}/км`
              }
              value={isWithinPushkino ? "Бесплатно" : formatRub(travelEstimate)}
            />
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
          Диагностика оплачивается только если проведена; за загородный выезд — плата только при
          проведённой диагностике. Если техники привозят в сервис, платы за выезд нет.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={onCreateRequest}
          className="min-h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Создать демо-заявку
        </button>
        <span className="text-sm text-slate-500">
          {requestCreated
            ? "Заявка DEMO-001 подготовлена для показа мастеру."
            : "Никаких данных на сервер не отправляется."}
        </span>
      </div>
    </div>
  );
};
