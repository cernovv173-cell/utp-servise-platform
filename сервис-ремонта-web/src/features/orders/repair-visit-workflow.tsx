import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, MapPinned } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import type { RepairOrder, Role } from "@/lib/api";
import {
  completeOnsiteRepair,
  completeRepairDiagnosis,
  consentRepairVisitPickup,
  markTechnicianRepairCompleted,
  verifyRepairVisitDistance,
} from "@/lib/api";

const buttonClass =
  "inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50";

export const RepairVisitWorkflow = ({
  order,
  token,
  role,
  userId,
  onRefresh,
}: {
  order: RepairOrder;
  token: string;
  role: Role;
  userId: string;
  onRefresh: () => Promise<unknown>;
}) => {
  const [isWithinCity, setIsWithinCity] = useState(order.visitIsWithinCity ?? true);
  const [distanceKm, setDistanceKm] = useState(
    String(order.visitVerifiedDistanceKm ?? order.visitCustomerDistanceKm ?? ""),
  );
  const [repairAgreed, setRepairAgreed] = useState(true);
  const [repairPriceRub, setRepairPriceRub] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "BANK_TRANSFER">("CASH");
  const [pickupPhoneConsentConfirmed, setPickupPhoneConsentConfirmed] = useState(false);
  const [onsitePhoneConsentConfirmed, setOnsitePhoneConsentConfirmed] = useState(false);
  const isHomeVisit = order.repairLocation === "CUSTOMER_ADDRESS";
  const wasTransferredToServiceCenter =
    order.repairLocation === "SERVICE_CENTER" && order.visitPickupAgreedAt != null;
  const isStaff = role === "ADMIN" || role === "TECHNICIAN";
  const isAssignedTechnician = role === "TECHNICIAN" && order.assignedTechnicianId === userId;
  const canUseAssignedActions = isAssignedTechnician;
  const diagnosisComplete = Boolean(order.diagnosisCompletedAt);
  const verifiedDistance = order.visitDistanceVerifiedAt != null;
  const latestEstimate = order.estimates?.at(-1);

  const refresh = async (message: string) => {
    toast.success(message);
    await onRefresh();
  };
  const distanceMutation = useMutation({
    mutationFn: () => {
      const numericDistance = isWithinCity ? 0 : Number(distanceKm);
      if (!Number.isInteger(numericDistance) || numericDistance < (isWithinCity ? 0 : 1)) {
        throw new Error("Введите целое расстояние в километрах.");
      }
      return verifyRepairVisitDistance(token, order.id, {
        isWithinCity,
        distanceKm: numericDistance,
      });
    },
    onSuccess: () => refresh("Расстояние сохранено после проверки по Яндекс Картам."),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить расстояние."),
  });
  const diagnosisMutation = useMutation({
    mutationFn: () => completeRepairDiagnosis(token, order.id),
    onSuccess: () => refresh("Диагностика отмечена; начисления добавлены к заявке."),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отметить диагностику."),
  });
  const pickupMutation = useMutation({
    mutationFn: () => consentRepairVisitPickup(token, order.id),
    onSuccess: () => refresh("Перевозка в сервис отмечена по согласию клиента."),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Не удалось оформить передачу в сервис.",
      ),
  });
  const repairCompleteMutation = useMutation({
    mutationFn: () => markTechnicianRepairCompleted(token, order.id),
    onSuccess: () => refresh("Ремонт отмечен завершённым; мастер может оформить выдачу клиенту."),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Не удалось отметить завершение ремонта.",
      ),
  });
  const onsiteMutation = useMutation({
    mutationFn: () => {
      const price = repairAgreed ? Number(repairPriceRub) : 0;
      if (repairAgreed && (!Number.isInteger(price) || price < 1)) {
        throw new Error("Введите согласованную с клиентом стоимость ремонта.");
      }
      if (!repairAgreed && !diagnosisComplete) {
        throw new Error("Сначала отметьте фактически проведённую диагностику.");
      }
      if (!onsitePhoneConsentConfirmed) {
        throw new Error("Подтвердите, что ответ клиента получен по телефону.");
      }
      return completeOnsiteRepair(token, order.id, {
        repairAgreed,
        repairPriceRub: price,
        paymentMethod,
      });
    },
    onSuccess: () => refresh("Оплата на выезде записана; заявка и чек закрыты."),
    onError: (error) =>
      toast.error(
        error instanceof Error ? error.message : "Не удалось сохранить оплату на выезде.",
      ),
  });

  if (!isStaff || (order.visitScenarioVersion ?? 0) < 1) return null;

  const numericPrice = repairAgreed ? Number(repairPriceRub) || 0 : 0;
  const expectedTotal = numericPrice + (order.diagnosisFeeRub ?? 0) + (order.visitFeeRub ?? 0);
  const canCompleteDiagnosis =
    canUseAssignedActions &&
    !diagnosisComplete &&
    ["ASSIGNED", "IN_PROGRESS"].includes(order.status) &&
    (!isHomeVisit || verifiedDistance);

  return (
    <section className="mt-3 grid gap-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <MapPinned size={17} aria-hidden="true" />
        {isHomeVisit
          ? "Выезд мастера · Пушкино"
          : wasTransferredToServiceCenter
            ? "После выезда · сервисный центр"
            : "Ремонт в сервисном центре"}
      </div>

      {wasTransferredToServiceCenter ? (
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
          Согласие на перевозку зафиксировано по телефону. После поступления техники мастер заполнит
          акт состояния и комплектности, согласует смету и работы с клиентом, затем сам оформит
          оплату и выдачу.
        </p>
      ) : !isHomeVisit ? (
        <p className="text-xs leading-5 text-slate-600 dark:text-slate-400">
          После приёма мастер ведёт заявку до конца: описывает состояние техники, согласует смету и
          дополнительные работы с клиентом по телефону, принимает оплату и выдаёт устройство.
        </p>
      ) : null}

      {isHomeVisit && (
        <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Клиент указал {order.visitIsWithinCity ? "адрес в Пушкино" : "адрес за Пушкино"}
            {order.visitCustomerDistanceKm != null
              ? ` и примерно ${order.visitCustomerDistanceKm} км от границы города`
              : ""}
            . Перед завершением диагностики подтвердите город и расстояние по Яндекс Картам.
          </p>
          {verifiedDistance ? (
            <p className="font-medium text-emerald-700 dark:text-emerald-300">
              Проверено:{" "}
              {order.visitIsWithinCity
                ? "Пушкино, выезд бесплатный"
                : `${order.visitVerifiedDistanceKm} км в одну сторону`}
              .
            </p>
          ) : null}
          {canUseAssignedActions && !diagnosisComplete && (
            <>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    [true, "В Пушкино"],
                    [false, "За городом"],
                  ] as const
                ).map(([value, label]) => (
                  <label
                    key={String(value)}
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs dark:border-slate-700"
                  >
                    <input
                      type="radio"
                      name={`verified-city-${order.id}`}
                      checked={isWithinCity === value}
                      onChange={() => setIsWithinCity(value as boolean)}
                      className="size-4 accent-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
              {!isWithinCity && (
                <label className="grid max-w-xs gap-1 text-xs font-medium">
                  Проверенное расстояние от границы, км
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    step={1}
                    value={distanceKm}
                    onChange={(event) => setDistanceKm(event.target.value)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                  />
                  {Number(distanceKm) > 0 && Number.isInteger(Number(distanceKm)) && (
                    <span className="font-semibold text-blue-700 dark:text-blue-300">
                      Плата после диагностики: {(Number(distanceKm) * 25).toLocaleString("ru-RU")} ₽
                    </span>
                  )}
                </label>
              )}
              <button
                type="button"
                className={buttonClass}
                disabled={distanceMutation.isPending || order.diagnosisCompletedAt != null}
                onClick={() => distanceMutation.mutate()}
              >
                {distanceMutation.isPending ? "Сохраняем…" : "Сохранить проверенное расстояние"}
              </button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-2 text-xs text-slate-600 sm:grid-cols-3 dark:text-slate-300">
        <p>
          Диагностика:{" "}
          {diagnosisComplete
            ? `${order.diagnosisFeeRub ?? 850} ₽ начислено`
            : "850 ₽, если проведена"}
        </p>
        <p>Выезд: {(order.visitFeeRub ?? 0).toLocaleString("ru-RU")} ₽</p>
        <p>Диагностика и выезд идут мастеру полностью; бонусами их не оплатить.</p>
      </div>

      {canUseAssignedActions && ["ASSIGNED", "IN_PROGRESS"].includes(order.status) && (
        <div className="grid gap-2 sm:flex sm:flex-wrap sm:items-center">
          {diagnosisComplete ? (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={16} aria-hidden="true" /> Диагностика завершена
            </p>
          ) : (
            <button
              type="button"
              className={buttonClass}
              disabled={!canCompleteDiagnosis || diagnosisMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    "Подтверждаете, что диагностика фактически проведена? Будет начислено 850 ₽.",
                  )
                )
                  diagnosisMutation.mutate();
              }}
            >
              {diagnosisMutation.isPending
                ? "Сохраняем…"
                : "Зафиксировать проведённую диагностику · 850 ₽"}
            </button>
          )}
        </div>
      )}

      {isHomeVisit &&
        role === "TECHNICIAN" &&
        isAssignedTechnician &&
        ["ASSIGNED", "IN_PROGRESS"].includes(order.status) &&
        !order.visitPickupAgreedAt && (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
            <p className="text-sm font-semibold">Если ремонт на месте невозможен</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Если на месте починить нельзя, позвоните клиенту и зафиксируйте его согласие на
              перевозку. Акт состояния и комплектности мастер заполнит в сервисе после поступления
              техники.
            </p>
            <label className="flex items-start gap-2 text-xs leading-5">
              <input
                type="checkbox"
                checked={pickupPhoneConsentConfirmed}
                onChange={(event) => setPickupPhoneConsentConfirmed(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-blue-600"
              />
              Клиент по телефону согласился передать устройство в сервисный центр.
            </label>
            <button
              type="button"
              className={buttonClass}
              disabled={pickupMutation.isPending || !pickupPhoneConsentConfirmed}
              onClick={() => {
                if (
                  window.confirm(
                    "Подтверждаете согласие клиента на перевозку, полученное по телефону?",
                  )
                )
                  pickupMutation.mutate();
              }}
            >
              {pickupMutation.isPending ? "Сохраняем…" : "Забрать в сервис"}
            </button>
          </div>
        )}

      {isHomeVisit &&
        role === "TECHNICIAN" &&
        isAssignedTechnician &&
        !order.visitPickupAgreedAt &&
        ["ASSIGNED", "IN_PROGRESS"].includes(order.status) && (
          <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
            <p className="text-sm font-semibold">Ремонт на месте согласует мастер по телефону</p>
            <div className="flex flex-wrap gap-3 text-sm">
              {(
                [
                  [true, "Клиент согласился на ремонт"],
                  [false, "Клиент отказался от ремонта"],
                ] as const
              ).map(([value, label]) => (
                <label key={String(value)} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`repair-agreed-${order.id}`}
                    checked={repairAgreed === value}
                    onChange={() => setRepairAgreed(value as boolean)}
                    className="size-4 accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            {repairAgreed && (
              <label className="grid max-w-xs gap-1 text-xs font-medium">
                Согласованная с клиентом стоимость ремонта, ₽
                <input
                  type="number"
                  min={1}
                  max={2147483647}
                  step={1}
                  value={repairPriceRub}
                  onChange={(event) => setRepairPriceRub(event.target.value)}
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
            )}
            <fieldset className="grid gap-2 text-xs">
              <legend className="font-medium">Как клиент оплатил мастеру</legend>
              <div className="flex gap-3">
                {(
                  [
                    ["CASH", "Наличными"],
                    ["BANK_TRANSFER", "Переводом"],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name={`payment-method-${order.id}`}
                      checked={paymentMethod === value}
                      onChange={() => setPaymentMethod(value)}
                      className="size-4 accent-blue-600"
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <p className="text-sm font-semibold">
              Итого: {expectedTotal.toLocaleString("ru-RU")} ₽
              {repairAgreed
                ? " (ремонт + выполненная диагностика + выезд)"
                : " (диагностика + выезд)"}
            </p>
            <label className="flex items-start gap-2 text-xs leading-5">
              <input
                type="checkbox"
                checked={onsitePhoneConsentConfirmed}
                onChange={(event) => setOnsitePhoneConsentConfirmed(event.target.checked)}
                className="mt-1 size-4 shrink-0 accent-blue-600"
              />
              Клиент подтвердил по телефону сумму ремонта и способ завершения заявки.
            </label>
            <button
              type="button"
              className={buttonClass}
              disabled={
                onsiteMutation.isPending || expectedTotal < 1 || !onsitePhoneConsentConfirmed
              }
              onClick={() => {
                if (
                  window.confirm(
                    "Подтверждаете согласование суммы с клиентом по телефону и получение оплаты наличными или переводом?",
                  )
                )
                  onsiteMutation.mutate();
              }}
            >
              {onsiteMutation.isPending ? "Сохраняем оплату…" : "Сохранить оплату и закрыть заявку"}
            </button>
          </div>
        )}

      {!isHomeVisit &&
        role === "TECHNICIAN" &&
        isAssignedTechnician &&
        order.status === "IN_PROGRESS" &&
        !order.technicianRepairCompletedAt && (
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              После завершения работ отметьте это здесь. Затем мастер сам переведёт заказ в статус
              «Готов к выдаче» и оформит возврат техники.
            </p>
            <button
              type="button"
              className={buttonClass}
              disabled={
                repairCompleteMutation.isPending ||
                latestEstimate?.status === "PENDING" ||
                (order.workActRequired && order.workAct?.status !== "APPROVED")
              }
              onClick={() => repairCompleteMutation.mutate()}
            >
              {repairCompleteMutation.isPending ? "Сохраняем…" : "Отметить ремонт завершённым"}
            </button>
          </div>
        )}

      {order.visitPickupAgreedAt && isHomeVisit === false && (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Клиент согласился на перевозку; дальнейший ремонт в сервисе.
        </p>
      )}
      {order.technicianRepairCompletedAt && (
        <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
          Мастер отметил ремонт завершённым:{" "}
          {new Date(order.technicianRepairCompletedAt).toLocaleString("ru-RU")}.
        </p>
      )}
    </section>
  );
};
