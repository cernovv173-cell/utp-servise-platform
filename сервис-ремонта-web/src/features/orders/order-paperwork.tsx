import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ImagePlus, Printer, ShieldCheck } from "lucide-react";
import { type ChangeEvent, useCallback, useState } from "react";
import { toast } from "sonner";

import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/modal";

import { type OrderDocumentKind, printOrderDocument } from "@/features/orders/order-document-print";

import {
  type RepairOrder,
  type RepairOrderIntake,
  fetchProtectedMedia,
  saveOrderIntake,
  uploadIntakePhoto,
} from "@/lib/api";

type Side = "front" | "back" | "left" | "right";
const sideFields: Array<{
  side: Side;
  label: string;
  condition: keyof Pick<
    RepairOrderIntake,
    "frontCondition" | "backCondition" | "leftCondition" | "rightCondition"
  >;
  photo: keyof Pick<
    RepairOrderIntake,
    "frontPhotoObjectId" | "backPhotoObjectId" | "leftPhotoObjectId" | "rightPhotoObjectId"
  >;
}> = [
  {
    side: "front",
    label: "Передняя сторона",
    condition: "frontCondition",
    photo: "frontPhotoObjectId",
  },
  { side: "back", label: "Задняя сторона", condition: "backCondition", photo: "backPhotoObjectId" },
  { side: "left", label: "Левая сторона", condition: "leftCondition", photo: "leftPhotoObjectId" },
  {
    side: "right",
    label: "Правая сторона",
    condition: "rightCondition",
    photo: "rightPhotoObjectId",
  },
];

const defaults = (intake: RepairOrderIntake | null | undefined) => ({
  frontCondition: intake?.frontCondition ?? "",
  backCondition: intake?.backCondition ?? "",
  leftCondition: intake?.leftCondition ?? "",
  rightCondition: intake?.rightCondition ?? "",
  serialNumber: intake?.serialNumber ?? "",
  includedAccessories: intake?.includedAccessories ?? "",
  intakeNotes: intake?.intakeNotes ?? "",
  frontPhotoObjectId: intake?.frontPhotoObjectId ?? null,
  backPhotoObjectId: intake?.backPhotoObjectId ?? null,
  leftPhotoObjectId: intake?.leftPhotoObjectId ?? null,
  rightPhotoObjectId: intake?.rightPhotoObjectId ?? null,
});

const ProtectedOrderPhoto = ({
  token,
  objectId,
  label,
}: {
  token: string;
  objectId: string | null;
  label: string;
}) => {
  const image = useQuery({
    queryKey: ["order-document-photo", token, objectId],
    queryFn: () => fetchProtectedMedia(token, objectId!),
    enabled: Boolean(objectId),
  });
  const imageData = image.data;
  const imageRef = useCallback(
    (element: HTMLImageElement | null) => {
      if (!element || !imageData) return;
      const objectUrl = URL.createObjectURL(imageData);
      element.src = objectUrl;
      return () => URL.revokeObjectURL(objectUrl);
    },
    [imageData],
  );
  return imageData ? (
    <img
      ref={imageRef}
      alt={label}
      className="mt-2 aspect-video w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
    />
  ) : (
    <div className="mt-2 grid aspect-video place-items-center rounded-lg bg-slate-100 text-xs text-slate-500 dark:bg-slate-800">
      {image.isLoading ? "Загружаем фото…" : "Фото пока не добавлено"}
    </div>
  );
};

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
  const [open, setOpen] = useState(false);
  const [document, setDocument] = useState<OrderDocumentKind>("intake");
  const [previousIntake, setPreviousIntake] = useState(order.intake);
  const [draft, setDraft] = useState(() => defaults(order.intake));
  if (previousIntake !== order.intake) {
    setPreviousIntake(order.intake);
    setDraft(defaults(order.intake));
  }
  const invalidateOrders = () => queryClient.invalidateQueries({ queryKey: ["orders", token] });
  const upload = useMutation({
    mutationFn: ({ side, file }: { side: Side; file: File }) =>
      uploadIntakePhoto(token, order.id, side, file),
    onSuccess: async ({ intake }, { side }) => {
      const photoKey = sideFields.find((entry) => entry.side === side)!.photo;
      setDraft((value) => ({ ...value, [photoKey]: intake[photoKey] }));
      toast.success("Фото стороны добавлено в акт.");
      await invalidateOrders();
    },
    onError: () =>
      toast.error("Не удалось загрузить фото. Заявка доступна только участникам ремонта."),
  });
  const save = useMutation({
    mutationFn: () =>
      saveOrderIntake(token, order.id, {
        frontCondition: draft.frontCondition,
        backCondition: draft.backCondition,
        leftCondition: draft.leftCondition,
        rightCondition: draft.rightCondition,
        serialNumber: draft.serialNumber,
        includedAccessories: draft.includedAccessories,
        intakeNotes: draft.intakeNotes,
      }),
    onSuccess: async () => {
      toast.success("Акт приёма сохранён.");
      await invalidateOrders();
    },
    onError: () =>
      toast.error("Для сохранения добавьте фотографии всех четырёх сторон и заполните описание."),
  });
  const print = (kind: OrderDocumentKind) => {
    void printOrderDocument(kind, order, order.intake ?? null, order.warranty ?? null, token).catch(
      (error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Не удалось подготовить документ к печати.",
        );
      },
    );
  };
  const changePhoto = (side: Side, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) upload.mutate({ side, file });
    event.currentTarget.value = "";
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
            Акт приёма фиксирует комплектность и внешнее состояние устройства; заказ-наряд
            использует данные ремонта, гарантийный талон формируется при выдаче по QR.
          </ModalDescription>
        </ModalHeader>
        <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="Документы заявки">
          {(
            [
              ["intake", "Акт приёма"],
              ["work-order", "Заказ-наряд"],
              ["warranty", "Гарантийный талон"],
            ] as const
          ).map(([value, label]) => (
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

        {document === "intake" && (
          <section className="mt-4 grid gap-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {sideFields.map(({ side, label, condition, photo }) => (
                <div
                  key={side}
                  className="rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                >
                  <label className="grid gap-1 text-sm font-semibold">
                    {label} · видимые повреждения{"\u00a0"}
                    <span aria-hidden="true">*</span>
                    <textarea
                      required
                      minLength={2}
                      maxLength={1000}
                      rows={2}
                      disabled={!canEditIntake}
                      value={draft[condition]}
                      onChange={(event) =>
                        setDraft((value) => ({ ...value, [condition]: event.target.value }))
                      }
                      className="rounded-lg border border-slate-200 bg-white p-2 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
                      placeholder="Опишите царапины, сколы, трещины или укажите «не обнаружены»"
                    />
                  </label>
                  <ProtectedOrderPhoto token={token} objectId={draft[photo]} label={label} />
                  {canEditIntake && (
                    <label className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700">
                      <ImagePlus size={14} aria-hidden="true" />
                      {draft[photo] ? "Заменить фото" : "Сфотографировать сторону"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="sr-only"
                        onChange={(event) => changePhoto(side, event)}
                        disabled={upload.isPending}
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
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
                  disabled={save.isPending || upload.isPending}
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
              Устройство: {order.deviceType} · серийный номер:{" "}
              {order.intake?.serialNumber ?? "не указан"}
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
            <p className="text-sm">
              Состояние при приёме:{" "}
              {order.intake
                ? [
                    order.intake.frontCondition,
                    order.intake.backCondition,
                    order.intake.leftCondition,
                    order.intake.rightCondition,
                  ].join(" · ")
                : "акт приёма не заполнен"}
            </p>
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
                  Устройство: {order.warranty.deviceType} · работы: {order.warranty.repairSummary}
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
