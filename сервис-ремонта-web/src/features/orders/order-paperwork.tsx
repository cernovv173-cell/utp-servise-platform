import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, ImagePlus, Printer, ShieldCheck } from "lucide-react";
import { type ChangeEvent, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/modal";

import { repairDeviceTypeLabel } from "@/features/catalog/catalog-model";
import { type OrderDocumentKind, printOrderDocument } from "@/features/orders/order-document-print";

import {
  type RepairOrder,
  type RepairOrderIntake,
  fetchProtectedMedia,
  saveOrderIntake,
  uploadIntakeMedia,
} from "@/lib/api";

const defaults = (intake: RepairOrderIntake | null | undefined) => ({
  conditionSummary:
    intake?.conditionSummary ||
    [intake?.frontCondition, intake?.backCondition, intake?.leftCondition, intake?.rightCondition]
      .filter(Boolean)
      .join("\n"),
  intakeMediaObjectId: intake?.intakeMediaObjectId ?? null,
  intakeMediaType: intake?.intakeMediaType ?? null,
  serialNumber: intake?.serialNumber ?? "",
  includedAccessories: intake?.includedAccessories ?? "",
  intakeNotes: intake?.intakeNotes ?? "",
});

const ProtectedOrderMedia = ({
  token,
  objectId,
  mediaType,
  label,
}: {
  token: string;
  objectId: string | null;
  mediaType: "IMAGE" | "VIDEO" | null;
  label: string;
}) => {
  const media = useQuery({
    queryKey: ["order-document-photo", token, objectId],
    queryFn: () => fetchProtectedMedia(token, objectId!),
    enabled: Boolean(objectId),
  });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVideo = mediaType === "VIDEO" || media.data?.type.startsWith("video/");
  useEffect(() => {
    if (!media.data) return;
    const objectUrl = URL.createObjectURL(media.data);
    const video = videoRef.current;
    const image = imageRef.current;
    if (isVideo && video) video.src = objectUrl;
    if (!isVideo && image) image.src = objectUrl;
    return () => {
      if (video?.src === objectUrl) {
        video.pause();
        video.removeAttribute("src");
        video.load();
      }
      if (image?.src === objectUrl) image.removeAttribute("src");
      URL.revokeObjectURL(objectUrl);
    };
  }, [isVideo, media.data]);
  return media.data ? (
    isVideo ? (
      <video
        ref={videoRef}
        controls
        playsInline
        aria-label={label}
        className="mt-2 aspect-video w-full rounded-lg border border-slate-200 bg-black object-contain dark:border-slate-700"
      />
    ) : (
      <img
        ref={imageRef}
        alt={label}
        className="mt-2 aspect-video w-full rounded-lg border border-slate-200 object-contain dark:border-slate-700"
      />
    )
  ) : (
    <div className="mt-2 grid aspect-video place-items-center rounded-lg bg-slate-100 text-xs text-slate-500 dark:bg-slate-800">
      {media.isLoading ? "Загружаем медиа…" : "Фото или видео пока не добавлено"}
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
    mutationFn: (file: File) => uploadIntakeMedia(token, order.id, file),
    onSuccess: async ({ intake }) => {
      setDraft((value) => ({
        ...value,
        intakeMediaObjectId: intake.intakeMediaObjectId,
        intakeMediaType: intake.intakeMediaType,
      }));
      toast.success("Фото или видео добавлено в акт.");
      await invalidateOrders();
    },
    onError: () =>
      toast.error("Не удалось загрузить фото. Заявка доступна только участникам ремонта."),
  });
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
    onError: () => toast.error("Проверьте описание состояния и добавьте одно фото или видео."),
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
  const changeMedia = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) upload.mutate(file);
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
            использует данные ремонта, гарантийный талон формируется при выдаче заказа.
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
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <p className="text-sm font-semibold">Фото или видео устройства</p>
              <ProtectedOrderMedia
                token={token}
                objectId={draft.intakeMediaObjectId}
                mediaType={draft.intakeMediaType}
                label="Фото или видео состояния устройства"
              />
              {canEditIntake && (
                <label className="mt-3 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700">
                  <ImagePlus size={14} aria-hidden="true" />
                  {draft.intakeMediaObjectId ? "Заменить файл" : "Добавить фото или видео"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,video/mp4"
                    className="sr-only"
                    onChange={changeMedia}
                    disabled={upload.isPending}
                  />
                </label>
              )}
              <p className="mt-2 text-xs text-slate-500">
                Один файл: фото до 5 МБ или видео MP4 до 20 МБ.
              </p>
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
              Устройство: {repairDeviceTypeLabel(order.deviceType)} · серийный номер:{" "}
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
              Состояние при приёме: {order.intake?.conditionSummary || "акт приёма не заполнен"}
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
