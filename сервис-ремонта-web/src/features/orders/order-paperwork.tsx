import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Printer, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/modal";

import { repairDeviceTypeLabel } from "@/features/catalog/catalog-model";
import { type OrderDocumentKind, printOrderDocument } from "@/features/orders/order-document-print";

import { type RepairOrder, type RepairOrderIntake, saveOrderIntake } from "@/lib/api";

const defaults = (intake: RepairOrderIntake | null | undefined) => ({
  conditionSummary:
    intake?.conditionSummary ||
    [intake?.frontCondition, intake?.backCondition, intake?.leftCondition, intake?.rightCondition]
      .filter(Boolean)
      .join("\n"),
  serialNumber: intake?.serialNumber ?? "",
  includedAccessories: intake?.includedAccessories ?? "",
  intakeNotes: intake?.intakeNotes ?? "",
});

const documentTabs = [
  ["intake", "Акт приёма"],
  ["work-order", "Заказ-наряд"],
  ["warranty", "Гарантийный талон"],
] as const;

export const OrderPaperwork = ({
  order,
  token,
  canEditIntake,
}: {
  order: RepairOrder;
  token: string;
  canEditIntake: boolean;
}) => {
  const queryClient = useQueryClient();
  const isVisitOrder = (order.visitScenarioVersion ?? 0) > 0;
  const isOnsiteVisit = isVisitOrder && order.repairLocation === "CUSTOMER_ADDRESS";
  const [open, setOpen] = useState(false);
  const [documentSelection, setDocumentSelection] = useState<{
    orderId: string;
    isOnsiteVisit: boolean;
    kind: OrderDocumentKind;
  }>({
    orderId: order.id,
    isOnsiteVisit,
    kind: isOnsiteVisit ? "work-order" : "intake",
  });
  const document =
    documentSelection.orderId === order.id && documentSelection.isOnsiteVisit === isOnsiteVisit
      ? documentSelection.kind
      : isOnsiteVisit
        ? "work-order"
        : "intake";
  const setDocument = (kind: OrderDocumentKind) =>
    setDocumentSelection({ orderId: order.id, isOnsiteVisit, kind });
  const [previousIntake, setPreviousIntake] = useState(order.intake);
  const [draft, setDraft] = useState(() => defaults(order.intake));
  if (previousIntake !== order.intake) {
    setPreviousIntake(order.intake);
    setDraft(defaults(order.intake));
  }
  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: ["orders", token] });
  const save = useMutation({
    mutationFn: () =>
      saveOrderIntake(token, order.id, {
        conditionSummary: draft.conditionSummary,
        serialNumber: draft.serialNumber,
        includedAccessories: draft.includedAccessories,
        intakeNotes: draft.intakeNotes,
      }),
    onSuccess: async () => {
      toast.success("Акт приёма сохранён.");
      await invalidateOrders();
    },
    onError: () => toast.error("Проверьте описание состояния устройства и повторите сохранение."),
  });
  const print = (kind: OrderDocumentKind) => {
    void printOrderDocument(kind, order, order.intake ?? null, order.warranty ?? null).catch(
      (error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Не удалось подготовить документ к печати.",
        );
      },
    );
  };
  const inputClass =
    "min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950";

  return (
    <Modal open={open} onOpenChange={setOpen}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold dark:border-slate-700"
      >
        <FileText size={15} aria-hidden="true" />
        Документы
      </button>
      <ModalContent className="max-w-3xl dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>Документы · {order.serviceNumber}</ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            {isOnsiteVisit
              ? "Для выездной заявки акт приёма-передачи не оформляется. Здесь доступны заказ-наряд и гарантийный талон."
              : "Акт приёма фиксирует комплектность и внешнее состояние устройства; заказ-наряд использует данные ремонта, гарантийный талон формируется при выдаче заказа."}
          </ModalDescription>
        </ModalHeader>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Документы заявки">
          {documentTabs
            .filter(([value]) => !isOnsiteVisit || value !== "intake")
            .map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={document === value}
                onClick={() => setDocument(value)}
                className={`min-h-10 rounded-lg border px-3 text-sm font-medium ${document === value ? "border-cyan-400 bg-cyan-50 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-100" : "border-slate-200 dark:border-slate-700"}`}
              >
                {label}
              </button>
            ))}
        </div>

        {!isOnsiteVisit && document === "intake" && (
          <section className="mt-4 grid gap-4">
            <label className="grid gap-1 text-sm font-semibold">
              Внешнее состояние и видимые повреждения
              <textarea
                required
                minLength={2}
                maxLength={3000}
                rows={4}
                disabled={!canEditIntake}
                value={draft.conditionSummary}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, conditionSummary: event.target.value }))
                }
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                placeholder="Кратко опишите состояние устройства и обнаруженные повреждения"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm font-medium">
                Серийный номер
                <input
                  value={draft.serialNumber}
                  maxLength={160}
                  disabled={!canEditIntake}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, serialNumber: event.target.value }))
                  }
                  className={inputClass}
                />
              </label>
              <label className="grid gap-1 text-sm font-medium">
                Комплектность / аксессуары
                <input
                  value={draft.includedAccessories}
                  maxLength={1000}
                  disabled={!canEditIntake}
                  onChange={(event) =>
                    setDraft((value) => ({ ...value, includedAccessories: event.target.value }))
                  }
                  className={inputClass}
                  placeholder="Зарядное устройство, чехол…"
                />
              </label>
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Дополнительные отметки
              <textarea
                value={draft.intakeNotes}
                maxLength={2000}
                rows={2}
                disabled={!canEditIntake}
                onChange={(event) =>
                  setDraft((value) => ({ ...value, intakeNotes: event.target.value }))
                }
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {canEditIntake && (
                <button
                  type="button"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                  className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {save.isPending ? "Сохраняем…" : "Сохранить акт приёма"}
                </button>
              )}
              {order.intake && (
                <button
                  type="button"
                  onClick={() => print("intake")}
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
                >
                  <Printer size={15} aria-hidden="true" />
                  Печать акта
                </button>
              )}
            </div>
          </section>
        )}

        {document === "work-order" && (
          <section className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            <h2 className="text-lg font-semibold">Заказ-наряд · {order.serviceNumber}</h2>
            <p className="text-sm text-slate-500">
              Клиент: {order.customer?.displayName ?? "—"} ·{" "}
              {order.contactPhone ?? "телефон не указан"}
            </p>
            <p className="text-sm">
              Устройство: {repairDeviceTypeLabel(order.deviceType)}
              {!isVisitOrder && ` · серийный номер: ${order.intake?.serialNumber ?? "не указан"}`}
            </p>
            <p className="text-sm">Заявленная неисправность: {order.problem}</p>
            <h3 className="font-semibold">Работы и материалы</h3>
            {order.items.length ? (
              <ul className="grid gap-2 text-sm">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex justify-between gap-3 border-b border-slate-100 pb-2 dark:border-slate-800"
                  >
                    <span>
                      {item.name} · {item.quantity} × {item.unitPriceRub} ₽
                    </span>
                    <b>{item.quantity * item.unitPriceRub} ₽</b>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Состав работ пока не указан.</p>
            )}
            {isVisitOrder ? (
              <p className="text-sm">
                Согласие клиента на перевозку:{" "}
                {order.visitPickupAgreedAt ? "подтверждено" : "не зафиксировано"}
              </p>
            ) : (
              <p className="text-sm">
                Состояние при приёме: {order.intake?.conditionSummary || "акт приёма не заполнен"}
              </p>
            )}
            <button
              type="button"
              onClick={() => print("work-order")}
              className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
            >
              <Printer size={15} aria-hidden="true" />
              Печать заказ-наряда
            </button>
          </section>
        )}

        {document === "warranty" && (
          <section className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
            {order.warranty ? (
              <>
                <h2 className="inline-flex items-center gap-2 text-lg font-semibold">
                  <ShieldCheck size={19} aria-hidden="true" />
                  Гарантийный талон {order.warranty.warrantyNumber}
                </h2>
                <p className="text-sm">Клиент: {order.warranty.customerName}</p>
                <p className="text-sm">
                  Устройство: {repairDeviceTypeLabel(order.warranty.deviceType)} · работы:{" "}
                  {order.warranty.repairSummary}
                </p>
                <p className="text-sm">
                  Срок:{" "}
                  {order.warranty.warrantyDays === 365 || order.warranty.warrantyDays === 366
                    ? "1 год"
                    : `${order.warranty.warrantyDays} дней`}{" "}
                  · до {new Date(order.warranty.expiresAt).toLocaleDateString("ru-RU")}
                </p>
                <p className="text-sm">
                  Выдан: {new Date(order.warranty.issuedAt).toLocaleDateString("ru-RU")}
                </p>
                <p className="text-sm whitespace-pre-wrap">Условия: {order.warranty.terms}</p>
                <button
                  type="button"
                  onClick={() => print("warranty")}
                  className="inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
                >
                  <Printer size={15} aria-hidden="true" />
                  Печать талона
                </button>
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Талон сформируется автоматически при выдаче заказа. Единый срок гарантии — 1 год.
              </p>
            )}
          </section>
        )}
      </ModalContent>
    </Modal>
  );
};
