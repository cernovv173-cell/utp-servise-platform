import { DIAGNOSIS_FEE_RUB, formatRub } from "./scenario-preview-model";
import { PreviewChoiceButton, PreviewSummaryLine } from "./scenario-preview-ui";

export const ScenarioTechnicianPanel = ({
  isVisit,
  isWithinPushkino,
  oneWayKm,
  verifiedKm,
  onVerifiedKmChange,
  diagnosisCompleted,
  onDiagnosisChange,
  travelFee,
  technicianFees,
  onsiteRepairPossible,
  onOnsiteRepairChange,
  customerAgreedToPickup,
  onPickupConsentChange,
  onsiteRepairPrice,
  onOnsiteRepairPriceChange,
  paymentMethod,
  onPaymentMethodChange,
  onsitePaymentRecorded,
  onRecordOnsitePayment,
  onSubmitEstimate,
}: {
  isVisit: boolean;
  isWithinPushkino: boolean;
  oneWayKm: string;
  verifiedKm: string | null;
  onVerifiedKmChange: (value: string) => void;
  diagnosisCompleted: boolean;
  onDiagnosisChange: (value: boolean) => void;
  travelFee: number;
  technicianFees: number;
  onsiteRepairPossible: boolean;
  onOnsiteRepairChange: (value: boolean) => void;
  customerAgreedToPickup: boolean;
  onPickupConsentChange: (value: boolean) => void;
  onsiteRepairPrice: string;
  onOnsiteRepairPriceChange: (value: string) => void;
  paymentMethod: "Наличные" | "Перевод";
  onPaymentMethodChange: (value: "Наличные" | "Перевод") => void;
  onsitePaymentRecorded: boolean;
  onRecordOnsitePayment: () => void;
  onSubmitEstimate: () => void;
}) => {
  const repairPrice = Math.max(0, Number(onsiteRepairPrice) || 0);

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-xl font-semibold">Работа мастера</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Заявка DEMO-001 · {isVisit ? "выезд к клиенту" : "приём в сервисе"}
        </p>
      </div>

      {isVisit && !isWithinPushkino && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-semibold">Проверка расстояния</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Сверьте километраж от границы Пушкино в одну сторону по Яндекс Картам.
          </p>
          <label className="mt-3 grid max-w-xs gap-1.5 text-sm font-medium">
            Проверенные километры
            <input
              type="number"
              min="0"
              step="1"
              value={verifiedKm ?? oneWayKm}
              onChange={(event) => onVerifiedKmChange(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <p className="mt-2 text-xs text-slate-500">
            Тариф после диагностики: {formatRub(travelFee)}. Макет к картам не подключён.
          </p>
        </div>
      )}

      <button
        type="button"
        aria-pressed={diagnosisCompleted}
        onClick={() => onDiagnosisChange(!diagnosisCompleted)}
        className={`flex min-h-12 items-center justify-between rounded-xl border px-4 text-left font-semibold ${diagnosisCompleted ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100" : "border-slate-200 dark:border-slate-700"}`}
      >
        <span>Диагностика проведена</span>
        <span className="text-sm">{diagnosisCompleted ? "Да" : "Нет"}</span>
      </button>

      {diagnosisCompleted && (
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
          <PreviewSummaryLine
            label="Диагностика — 100% мастеру"
            value={formatRub(DIAGNOSIS_FEE_RUB)}
          />
          <PreviewSummaryLine
            label="Загородный выезд — 100% мастеру"
            value={formatRub(travelFee)}
          />
          <p className="mt-2 text-xs text-slate-500">
            Отдельно от процента за услуги и не оплачивается бонусами.
          </p>
        </div>
      )}

      {isVisit ? (
        <>
          <div className="grid gap-2 sm:grid-cols-2">
            <PreviewChoiceButton
              active={onsiteRepairPossible}
              onClick={() => onOnsiteRepairChange(true)}
            >
              Ремонт возможен на месте
            </PreviewChoiceButton>
            <PreviewChoiceButton
              active={!onsiteRepairPossible}
              onClick={() => onOnsiteRepairChange(false)}
            >
              Нужно везти в сервис
            </PreviewChoiceButton>
          </div>
          {onsiteRepairPossible ? (
            <div className="grid gap-4 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
              <p className="text-sm leading-6">
                Мастер сам согласует состав и цену ремонта с клиентом — администратор на месте не
                участвует.
              </p>
              <label className="grid max-w-xs gap-1.5 text-sm font-medium">
                Согласованная цена ремонта, ₽
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={onsiteRepairPrice}
                  onChange={(event) => onOnsiteRepairPriceChange(event.target.value)}
                  className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <PreviewChoiceButton
                  active={paymentMethod === "Наличные"}
                  onClick={() => onPaymentMethodChange("Наличные")}
                >
                  Наличные
                </PreviewChoiceButton>
                <PreviewChoiceButton
                  active={paymentMethod === "Перевод"}
                  onClick={() => onPaymentMethodChange("Перевод")}
                >
                  Перевод
                </PreviewChoiceButton>
              </div>
              <PreviewSummaryLine
                label="Демонстрационная сумма к оплате"
                value={formatRub(repairPrice + technicianFees)}
              />
              <button
                type="button"
                disabled={!diagnosisCompleted}
                onClick={onRecordOnsitePayment}
                className="min-h-11 w-fit rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {onsitePaymentRecorded ? "Демо-оплата отмечена" : "Записать демо-оплату мастеру"}
              </button>
              {onsitePaymentRecorded && (
                <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                  В макете отмечено: {paymentMethod.toLowerCase()}, данные не сохранены.
                </p>
              )}
            </div>
          ) : (
            <div className="grid gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
              <p className="text-sm leading-6">
                Если на месте не починить, мастер с согласия клиента фиксирует состояние и
                комплектность и передаёт технику в сервис.
              </p>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={customerAgreedToPickup}
                  onChange={(event) => onPickupConsentChange(event.target.checked)}
                  className="mt-1 size-4 accent-blue-600"
                />
                Клиент согласен на перевозку в сервис
              </label>
            </div>
          )}
        </>
      ) : (
        <div className="grid gap-3 rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
          <h3 className="font-semibold">Техника в сервисе</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            После диагностики мастер передаёт смету администратору для согласования с клиентом.
          </p>
          <button
            type="button"
            disabled={!diagnosisCompleted}
            onClick={onSubmitEstimate}
            className="min-h-11 w-fit rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            Передать смету администратору
          </button>
        </div>
      )}
    </div>
  );
};
