import { ArrowLeft, Check } from "lucide-react";
import { useState } from "react";

import { ScenarioAdministratorPanel } from "./scenario-preview-admin";
import { ScenarioClientPanel } from "./scenario-preview-client";
import {
  DIAGNOSIS_FEE_RUB,
  calculateTechnicianFeesRub,
  calculateTravelFeeRub,
  formatRub,
} from "./scenario-preview-model";
import { ScenarioTechnicianPanel } from "./scenario-preview-technician";
import { PreviewNotice, PreviewSummaryLine } from "./scenario-preview-ui";

type UserRole = "Клиент" | "Мастер" | "Администратор";
type RepairLocation = "SERVICE_CENTER" | "CUSTOMER_ADDRESS";

const roleOptions: UserRole[] = ["Клиент", "Мастер", "Администратор"];

export const ScenarioPreviewPage = () => {
  const [role, setRole] = useState<UserRole>("Клиент");
  const [repairLocation, setRepairLocation] = useState<RepairLocation>("CUSTOMER_ADDRESS");
  const [address, setAddress] = useState("");
  const [isWithinPushkino, setIsWithinPushkino] = useState(false);
  const [oneWayKm, setOneWayKm] = useState("18");
  const [verifiedKm, setVerifiedKm] = useState<string | null>(null);
  const [diagnosisCompleted, setDiagnosisCompleted] = useState(false);
  const [requestCreated, setRequestCreated] = useState(false);
  const [onsiteRepairPossible, setOnsiteRepairPossible] = useState(true);
  const [customerAgreedToPickup, setCustomerAgreedToPickup] = useState(false);
  const [onsiteRepairPrice, setOnsiteRepairPrice] = useState("4500");
  const [paymentMethod, setPaymentMethod] = useState<"Наличные" | "Перевод">("Перевод");
  const [onsitePaymentRecorded, setOnsitePaymentRecorded] = useState(false);
  const [estimateSubmitted, setEstimateSubmitted] = useState(false);
  const [estimateApproved, setEstimateApproved] = useState<boolean | null>(null);
  const [repairCompleted, setRepairCompleted] = useState(false);
  const [orderReleased, setOrderReleased] = useState(false);
  const [servicePaymentMethod, setServicePaymentMethod] = useState("Перевод");

  const isVisit = repairLocation === "CUSTOMER_ADDRESS";
  const billableKm = Math.max(0, Number(verifiedKm ?? oneWayKm) || 0);
  const travelFee = isVisit
    ? calculateTravelFeeRub({ isWithinPushkino, diagnosisCompleted, oneWayKm: billableKm })
    : 0;
  const technicianFees = isVisit
    ? calculateTechnicianFeesRub({ isWithinPushkino, diagnosisCompleted, oneWayKm: billableKm })
    : diagnosisCompleted
      ? DIAGNOSIS_FEE_RUB
      : 0;
  const repairPrice = Math.max(0, Number(onsiteRepairPrice) || 0);

  const resetPreview = () => {
    setRole("Клиент");
    setRepairLocation("CUSTOMER_ADDRESS");
    setAddress("");
    setIsWithinPushkino(false);
    setOneWayKm("18");
    setVerifiedKm(null);
    setDiagnosisCompleted(false);
    setRequestCreated(false);
    setOnsiteRepairPossible(true);
    setCustomerAgreedToPickup(false);
    setOnsiteRepairPrice("4500");
    setPaymentMethod("Перевод");
    setOnsitePaymentRecorded(false);
    setEstimateSubmitted(false);
    setEstimateApproved(null);
    setRepairCompleted(false);
    setOrderReleased(false);
    setServicePaymentMethod("Перевод");
  };

  const currentStage = orderReleased
    ? "Выдана администратором"
    : onsitePaymentRecorded
      ? "Оплачено мастеру на выезде"
      : repairCompleted
        ? "Готова к выдаче"
        : estimateApproved === true
          ? "Ремонт согласован"
          : estimateApproved === false
            ? "Клиент отказался от ремонта"
            : estimateSubmitted
              ? "Смета отправлена администратору"
              : diagnosisCompleted
                ? "Диагностика проведена"
                : requestCreated
                  ? "Назначена мастеру"
                  : "Черновик заявки";

  return (
    <main className="min-h-dvh bg-slate-50/70 px-4 py-5 text-slate-900 sm:px-6 sm:py-8 dark:bg-slate-950/60 dark:text-slate-100">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <a
            href="/"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700 dark:text-sky-300"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            На сайт
          </a>
          <button
            type="button"
            onClick={resetPreview}
            className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold dark:border-slate-700 dark:bg-slate-900"
          >
            Сбросить макет
          </button>
        </div>

        <header className="mb-6">
          <p className="text-xs font-bold tracking-[0.18em] text-blue-700 uppercase dark:text-sky-300">
            ЕНОТ СЕРВИС · ПРЕДВАРИТЕЛЬНЫЙ МАКЕТ
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
            Заявка на ремонт техники
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
            Один сценарий для существующих сайта и Android: клиентская заявка, работа мастера и
            выдача администратором.
          </p>
        </header>

        <div className="mb-6">
          <PreviewNotice />
        </div>

        <section
          className="mb-6 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4 dark:border-slate-700 dark:bg-slate-900"
          aria-label="Экраны по ролям"
        >
          <div className="grid grid-cols-3 gap-2" role="tablist">
            {roleOptions.map((option) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={role === option}
                onClick={() => setRole(option)}
                className={`min-h-11 rounded-xl px-2 text-sm font-semibold transition sm:px-4 ${role === option ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"}`}
              >
                {option}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500">
              Демо-статус: {currentStage}
            </span>
            <span className="text-xs text-slate-500">Заявка DEMO-001 · без сохранения</span>
          </div>
        </section>

        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.85fr)]">
          <section
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 dark:border-slate-700 dark:bg-slate-900"
            role="tabpanel"
          >
            {role === "Клиент" && (
              <ScenarioClientPanel
                repairLocation={repairLocation}
                onRepairLocationChange={setRepairLocation}
                address={address}
                onAddressChange={setAddress}
                isWithinPushkino={isWithinPushkino}
                onWithinPushkinoChange={setIsWithinPushkino}
                oneWayKm={oneWayKm}
                onOneWayKmChange={(value) => {
                  setOneWayKm(value);
                  setVerifiedKm(null);
                }}
                requestCreated={requestCreated}
                onCreateRequest={() => setRequestCreated(true)}
              />
            )}
            {role === "Мастер" && (
              <ScenarioTechnicianPanel
                isVisit={isVisit}
                isWithinPushkino={isWithinPushkino}
                oneWayKm={oneWayKm}
                verifiedKm={verifiedKm}
                onVerifiedKmChange={setVerifiedKm}
                diagnosisCompleted={diagnosisCompleted}
                onDiagnosisChange={setDiagnosisCompleted}
                travelFee={travelFee}
                technicianFees={technicianFees}
                onsiteRepairPossible={onsiteRepairPossible}
                onOnsiteRepairChange={setOnsiteRepairPossible}
                customerAgreedToPickup={customerAgreedToPickup}
                onPickupConsentChange={setCustomerAgreedToPickup}
                onsiteRepairPrice={onsiteRepairPrice}
                onOnsiteRepairPriceChange={setOnsiteRepairPrice}
                paymentMethod={paymentMethod}
                onPaymentMethodChange={setPaymentMethod}
                onsitePaymentRecorded={onsitePaymentRecorded}
                onRecordOnsitePayment={() => setOnsitePaymentRecorded(true)}
                onSubmitEstimate={() => setEstimateSubmitted(true)}
              />
            )}
            {role === "Администратор" && (
              <ScenarioAdministratorPanel
                isVisit={isVisit}
                isWithinPushkino={isWithinPushkino}
                oneWayKm={oneWayKm}
                verifiedKm={verifiedKm}
                onVerifiedKmChange={setVerifiedKm}
                onsiteRepairPossible={onsiteRepairPossible}
                customerAgreedToPickup={customerAgreedToPickup}
                onsitePaymentRecorded={onsitePaymentRecorded}
                repairPrice={repairPrice}
                technicianFees={technicianFees}
                paymentMethod={paymentMethod}
                diagnosisCompleted={diagnosisCompleted}
                estimateSubmitted={estimateSubmitted}
                estimateApproved={estimateApproved}
                onEstimateDecision={setEstimateApproved}
                repairCompleted={repairCompleted}
                onRepairCompleted={() => setRepairCompleted(true)}
                orderReleased={orderReleased}
                onOrderReleased={() => setOrderReleased(true)}
                servicePaymentMethod={servicePaymentMethod}
                onServicePaymentMethodChange={setServicePaymentMethod}
              />
            )}
          </section>

          <aside className="grid gap-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold">Расчёт по текущему примеру</h2>
              <div className="mt-2">
                <PreviewSummaryLine
                  label="Место ремонта"
                  value={isVisit ? "У клиента" : "В сервисе"}
                />
                {isVisit && (
                  <PreviewSummaryLine
                    label="Расстояние от границы Пушкино"
                    value={
                      isWithinPushkino
                        ? "В пределах города"
                        : `${verifiedKm ?? oneWayKm} км в одну сторону`
                    }
                  />
                )}
                <PreviewSummaryLine
                  label="Диагностика проведена"
                  value={diagnosisCompleted ? formatRub(DIAGNOSIS_FEE_RUB) : "Пока нет — 0 ₽"}
                />
                {isVisit && (
                  <PreviewSummaryLine label="Загородный выезд" value={formatRub(travelFee)} />
                )}
                <PreviewSummaryLine
                  label="Начисления мастеру за эти позиции"
                  value={formatRub(technicianFees)}
                />
              </div>
              <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">
                Диагностика начисляется один раз за заявку. Загородный выезд — 25 ₽/км в одну
                сторону только после диагностики. Обе суммы полностью идут мастеру.
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <h2 className="font-semibold">Что уже подтверждено</h2>
              <ul className="mt-3 grid gap-2.5 text-sm leading-5 text-slate-600 dark:text-slate-300">
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  Пушкино — базовый город; внутри города выезд бесплатный.
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  Километры указывает клиент, от границы Пушкино в одну сторону.
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  На месте мастер договаривается с клиентом без администратора.
                </li>
                <li className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  Наличные или перевод на выезде; выдача в сервисе — администратором.
                </li>
              </ul>
            </section>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <h2 className="font-semibold">Нужно проверить перед настоящим запуском</h2>
              <p className="mt-2 text-sm leading-5">
                Если ремонт сразу завершён у клиента, макет складывает ремонт, проведённую
                диагностику и загородный выезд в одну демонстрационную сумму к оплате мастеру.
                Рабочая оплата пока не подключена.
              </p>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
};
