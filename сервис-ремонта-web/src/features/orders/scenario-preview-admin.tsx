import { BadgeCheck, Check, ClipboardCheck } from "lucide-react";

import { DIAGNOSIS_FEE_RUB, formatRub } from "./scenario-preview-model";
import { PreviewChoiceButton, PreviewSummaryLine } from "./scenario-preview-ui";

export const ScenarioAdministratorPanel = ({
  isVisit,
  isWithinPushkino,
  oneWayKm,
  verifiedKm,
  onVerifiedKmChange,
  onsiteRepairPossible,
  customerAgreedToPickup,
  onsitePaymentRecorded,
  repairPrice,
  technicianFees,
  paymentMethod,
  diagnosisCompleted,
  estimateSubmitted,
  estimateApproved,
  onEstimateDecision,
  repairCompleted,
  onRepairCompleted,
  orderReleased,
  onOrderReleased,
  servicePaymentMethod,
  onServicePaymentMethodChange,
}: {
  isVisit: boolean;
  isWithinPushkino: boolean;
  oneWayKm: string;
  verifiedKm: string | null;
  onVerifiedKmChange: (value: string) => void;
  onsiteRepairPossible: boolean;
  customerAgreedToPickup: boolean;
  onsitePaymentRecorded: boolean;
  repairPrice: number;
  technicianFees: number;
  paymentMethod: string;
  diagnosisCompleted: boolean;
  estimateSubmitted: boolean;
  estimateApproved: boolean | null;
  onEstimateDecision: (approved: boolean) => void;
  repairCompleted: boolean;
  onRepairCompleted: () => void;
  orderReleased: boolean;
  onOrderReleased: () => void;
  servicePaymentMethod: string;
  onServicePaymentMethodChange: (method: string) => void;
}) => {
  const isWaitingForPickupConsent = isVisit && !onsiteRepairPossible && !customerAgreedToPickup;
  const isTechnicianHandlingOnsite = isVisit && onsiteRepairPossible;

  return (
    <div className="grid gap-5">
      <div>
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-5 text-blue-600 dark:text-sky-300" aria-hidden="true" />
          <h2 className="text-xl font-semibold">Работа администратора</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          В сервисе администратор принимает технику, согласует смету и выдаёт её клиенту.
        </p>
      </div>

      {isVisit && !isWithinPushkino && (
        <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <h3 className="font-semibold">Проверка расстояния</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Сверьте расстояние от границы Пушкино в одну сторону по Яндекс Картам. Расчёт маршрута
            автоматически не подключён.
          </p>
          <label className="mt-3 grid max-w-xs gap-1.5 text-sm font-medium">
            Подтверждённые километры
            <input
              type="number"
              min="0"
              step="1"
              value={verifiedKm ?? oneWayKm}
              onChange={(event) => onVerifiedKmChange(event.target.value)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
        </div>
      )}

      {isTechnicianHandlingOnsite ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-950/30">
          <h3 className="font-semibold">На выезде администратор не нужен</h3>
          <p className="mt-1 text-sm leading-6">
            Если мастер ремонтирует технику у клиента, он сам согласует цену, принимает наличные или
            перевод и отмечает результат в своём старом приложении.
          </p>
          {onsitePaymentRecorded && (
            <PreviewSummaryLine
              label="Отмеченная мастером оплата"
              value={`${formatRub(repairPrice + technicianFees)} · ${paymentMethod}`}
            />
          )}
        </div>
      ) : isWaitingForPickupConsent ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          Выездной мастер не может отремонтировать технику. Ожидается согласие клиента на перевозку
          в сервис; до согласия заявка администратору не передаётся.
        </p>
      ) : (
        <>
          <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/70">
            <h3 className="font-semibold">Поступила в сервис</h3>
            <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
              Администратор фиксирует состояние и комплектность, затем получает от мастера результат
              диагностики и смету.
            </p>
          </div>
          {!diagnosisCompleted ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Ожидается отметка мастера о проведённой диагностике.
            </p>
          ) : !estimateSubmitted ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              Диагностика проведена. Ожидается смета мастера.
            </p>
          ) : estimateApproved === null ? (
            <div className="grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-center gap-2 font-semibold">
                <BadgeCheck className="size-5 text-emerald-600" aria-hidden="true" />
                Смета готова к согласованию
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Дополнительные работы и запчасти входят в итог только после согласования клиента.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onEstimateDecision(true)}
                  className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-semibold text-white"
                >
                  Клиент согласовал
                </button>
                <button
                  type="button"
                  onClick={() => onEstimateDecision(false)}
                  className="min-h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold dark:border-slate-600"
                >
                  Клиент отказался
                </button>
              </div>
            </div>
          ) : estimateApproved === false ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              При проведённой диагностике остаётся отдельная плата {formatRub(DIAGNOSIS_FEE_RUB)}.
              Если клиент отказался до диагностики, диагностика не начисляется.
            </p>
          ) : !repairCompleted ? (
            <button
              type="button"
              onClick={onRepairCompleted}
              className="min-h-11 w-fit rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
            >
              Отметить: ремонт завершён
            </button>
          ) : !orderReleased ? (
            <div className="grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
              <p className="font-semibold">Выдача доступна только администратору</p>
              <p className="text-sm leading-5 text-slate-600 dark:text-slate-300">
                Бонусы можно списать максимум на 30% стоимости услуг; диагностика и запчасти
                исключены. Остаток можно распределить между наличными, картой и переводом.
              </p>
              <div className="flex flex-wrap gap-2">
                {["Наличные", "Карта", "Перевод"].map((method) => (
                  <PreviewChoiceButton
                    key={method}
                    active={servicePaymentMethod === method}
                    onClick={() => onServicePaymentMethodChange(method)}
                  >
                    {method}
                  </PreviewChoiceButton>
                ))}
              </div>
              <button
                type="button"
                onClick={onOrderReleased}
                className="min-h-11 w-fit rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white"
              >
                Выдать демо-заявку
              </button>
            </div>
          ) : (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              <Check className="size-5" aria-hidden="true" />В демо отмечено: выдано
              администратором, оплата — {servicePaymentMethod.toLowerCase()}.
            </p>
          )}
        </>
      )}
    </div>
  );
};
