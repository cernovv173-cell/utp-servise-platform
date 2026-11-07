import { useMutation } from "@tanstack/react-query";
import { Check, Plus, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Select } from "@/components/select";

import { useAuth } from "@/features/auth/auth-context";

import {
  type RepairCatalogItem,
  type RepairDeviceType,
  type RepairEstimate,
  type RepairOrder,
  reviewRepairEstimate,
  submitRepairEstimate,
} from "@/lib/api";

const statusLabels: Record<RepairEstimate["status"], string> = {
  PENDING: "Ожидает подтверждения администратора",
  APPROVED: "Подтверждена",
  DECLINED: "Отклонена",
  SUPERSEDED: "Заменена новой версией",
};

const typeLabels = {
  SERVICE: "Работа",
  SPARE_PART: "Запчасть",
  PRODUCT: "Товар",
} as const;

type DraftItem = { catalogItemId: string; quantity: string };

export const RepairEstimatePanel = ({
  order,
  token,
  catalogItems,
  onRefresh,
}: {
  order: RepairOrder;
  token: string;
  catalogItems: RepairCatalogItem[];
  onRefresh: () => Promise<unknown>;
}) => {
  const { user } = useAuth();
  const estimates = order.estimates ?? [];
  const latest = estimates.at(-1);
  const [diagnosis, setDiagnosis] = useState("");
  const [draftItems, setDraftItems] = useState<DraftItem[]>([{ catalogItemId: "", quantity: "1" }]);
  const [decisionNote, setDecisionNote] = useState("");
  const activeCatalogItems = catalogItems.filter(
    (item) =>
      item.active &&
      (item.type === "PRODUCT" || item.deviceTypes.includes(order.deviceType as RepairDeviceType)),
  );
  const canManage =
    user?.role === "ADMIN" ||
    (user?.role === "TECHNICIAN" && order.assignedTechnicianId === user.id);
  const canSubmit =
    canManage &&
    ["ASSIGNED", "IN_PROGRESS"].includes(order.status) &&
    !(order.status === "ASSIGNED" && latest?.status === "APPROVED");
  const review = useMutation({
    mutationFn: ({
      estimateId,
      decision,
      note,
    }: {
      estimateId: string;
      decision: "APPROVED" | "DECLINED";
      note?: string;
    }) => reviewRepairEstimate(token, order.id, estimateId, decision, note),
    onSuccess: async (_result, variables) => {
      toast.success(
        variables.decision === "APPROVED"
          ? "Смета подтверждена администратором. Работы и запчасти закреплены за заявкой."
          : "Смета отклонена и возвращена на доработку.",
      );
      setDecisionNote("");
      await onRefresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось обработать смету."),
  });
  const submit = useMutation({
    mutationFn: () =>
      submitRepairEstimate(token, order.id, {
        diagnosis: diagnosis.trim(),
        items: draftItems.map((item) => ({
          catalogItemId: item.catalogItemId,
          quantity: Number(item.quantity),
        })),
      }),
    onSuccess: async () => {
      toast.success("Смета передана администратору на подтверждение.");
      setDiagnosis("");
      setDraftItems([{ catalogItemId: "", quantity: "1" }]);
      await onRefresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось отправить смету."),
  });

  const submitDraft = () => {
    if (diagnosis.trim().length < 3) {
      toast.error("Добавьте результат диагностики.");
      return;
    }
    if (
      !draftItems.length ||
      draftItems.some(
        (item) =>
          !item.catalogItemId ||
          !Number.isInteger(Number(item.quantity)) ||
          Number(item.quantity) < 1 ||
          Number(item.quantity) > 99,
      )
    ) {
      toast.error("Выберите позиции и укажите количество от 1 до 99.");
      return;
    }
    submit.mutate();
  };

  const latestPendingEstimate = latest?.status === "PENDING" ? latest : undefined;
  const canReview =
    user?.role === "ADMIN" &&
    latestPendingEstimate &&
    ["ASSIGNED", "IN_PROGRESS"].includes(order.status);

  return (
    <section className="mt-4 rounded-2xl border border-cyan-200/70 bg-cyan-50/60 p-4 dark:border-[#315989] dark:bg-[#0b1a32]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-cyan-800 uppercase dark:text-cyan-200">
            Проверка сметы
          </p>
          <h3 className="mt-1 text-base font-semibold">Сметы ремонта</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-300">
            Запчасти не списываются до подтверждения сметы администратором. После этого стоимость и
            состав зафиксируются в заказе; дополнительные работы также проверит администратор.
          </p>
        </div>
        <span className="rounded-full border border-cyan-200 bg-white px-3 py-1 text-xs font-semibold text-cyan-900 dark:border-[#315989] dark:bg-[#102342] dark:text-cyan-100">
          {estimates.length ? `Версий: ${estimates.length}` : "Пока нет"}
        </span>
      </div>

      {latestPendingEstimate && (
        <div className="mt-4 rounded-xl border border-amber-200 bg-white p-4 dark:border-amber-900 dark:bg-slate-950">
          <p className="text-sm font-semibold">
            {user?.role === "ADMIN"
              ? `Смета №${latestPendingEstimate.version} ожидает вашего подтверждения.`
              : `Смета №${latestPendingEstimate.version} передана администратору на проверку.`}
          </p>
          {canReview && (
            <>
              <label className="mt-3 grid gap-1 text-xs font-medium">
                Комментарий к решению (необязательно)
                <textarea
                  value={decisionNote}
                  onChange={(event) => setDecisionNote(event.target.value)}
                  maxLength={500}
                  rows={2}
                  className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900"
                />
              </label>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({
                      estimateId: latestPendingEstimate.id,
                      decision: "APPROVED",
                      note: decisionNote.trim() || undefined,
                    })
                  }
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Check size={16} aria-hidden="true" /> Подтвердить смету
                </button>
                <button
                  type="button"
                  disabled={review.isPending}
                  onClick={() =>
                    review.mutate({
                      estimateId: latestPendingEstimate.id,
                      decision: "DECLINED",
                      note: decisionNote.trim() || undefined,
                    })
                  }
                  className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-rose-200 px-4 text-sm font-semibold text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"
                >
                  <X size={16} aria-hidden="true" /> Вернуть мастеру на доработку
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {estimates.length > 0 && (
        <ol className="mt-4 grid gap-3">
          {[...estimates].reverse().map((estimate) => (
            <li
              key={estimate.id}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold">
                  {estimate.kind === "INITIAL" ? "Первоначальная смета" : "Дополнительные работы"} ·
                  №{estimate.version}
                </p>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${estimate.status === "APPROVED" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" : estimate.status === "PENDING" ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200" : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}
                >
                  {statusLabels[estimate.status]}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                {estimate.diagnosis}
              </p>
              <div className="mt-3 grid gap-2">
                {estimate.itemsSnapshot.map((item) => (
                  <div
                    key={`${estimate.id}-${item.catalogItemId}`}
                    className="flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <span>
                      <span className="mr-2 text-slate-500">{typeLabels[item.type]}</span>
                      {item.name} · {item.quantity} × {item.unitPriceRub.toLocaleString("ru-RU")} ₽
                    </span>
                    <strong>{(item.quantity * item.unitPriceRub).toLocaleString("ru-RU")} ₽</strong>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                <span className="text-xs text-slate-500">
                  {new Date(estimate.submittedAt).toLocaleString("ru-RU")}
                  {estimate.createdBy ? ` · ${estimate.createdBy.displayName}` : ""}
                </span>
                <strong className="text-base text-blue-700 dark:text-cyan-200">
                  Итого: {estimate.totalRub.toLocaleString("ru-RU")} ₽
                </strong>
              </div>
              {estimate.customerResponseNote && (
                <p className="mt-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                  Комментарий к решению: {estimate.customerResponseNote}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}

      {canSubmit && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
          <h4 className="text-sm font-semibold">
            {order.status === "IN_PROGRESS"
              ? "Предложить дополнительные работы"
              : "Подготовить смету"}
          </h4>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Цены берутся из каталога на сервере и не редактируются с этого экрана.
          </p>
          <label className="mt-3 grid gap-1 text-xs font-medium">
            Результат диагностики
            <textarea
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Опишите неисправность и необходимые работы"
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <div className="mt-3 grid gap-2">
            {draftItems.map((item, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
                <Select
                  ariaLabel={`Позиция сметы ${index + 1}`}
                  value={item.catalogItemId || undefined}
                  onValueChange={(catalogItemId) =>
                    setDraftItems((current) =>
                      current.map((draft, draftIndex) =>
                        draftIndex === index ? { ...draft, catalogItemId } : draft,
                      ),
                    )
                  }
                  placeholder="Выберите услугу, запчасть или товар"
                  options={activeCatalogItems.map((catalogItem) => ({
                    value: catalogItem.id,
                    label: `${typeLabels[catalogItem.type]} · ${catalogItem.name} · ${catalogItem.unitPriceRub.toLocaleString("ru-RU")} ₽${catalogItem.stockQuantity === null ? "" : ` · остаток ${catalogItem.stockQuantity}`}`,
                    disabled:
                      draftItems.some(
                        (draft, draftIndex) =>
                          draftIndex !== index && draft.catalogItemId === catalogItem.id,
                      ) ||
                      (catalogItem.stockQuantity !== null && catalogItem.stockQuantity < 1),
                  }))}
                  className="dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                />
                <label className="sr-only" htmlFor={`estimate-quantity-${order.id}-${index}`}>
                  Количество позиции сметы {index + 1}
                </label>
                <input
                  id={`estimate-quantity-${order.id}-${index}`}
                  type="number"
                  min={1}
                  max={99}
                  step={1}
                  value={item.quantity}
                  onChange={(event) =>
                    setDraftItems((current) =>
                      current.map((draft, draftIndex) =>
                        draftIndex === index ? { ...draft, quantity: event.target.value } : draft,
                      ),
                    )
                  }
                  className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-900"
                />
                <button
                  type="button"
                  disabled={draftItems.length === 1}
                  onClick={() =>
                    setDraftItems((current) =>
                      current.filter((_, draftIndex) => draftIndex !== index),
                    )
                  }
                  className="min-h-10 rounded-lg border border-slate-200 px-3 text-xs disabled:opacity-40 dark:border-slate-700"
                >
                  Удалить строку
                </button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={draftItems.length >= 50}
              onClick={() =>
                setDraftItems((current) => [...current, { catalogItemId: "", quantity: "1" }])
              }
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-xs font-semibold disabled:opacity-40 dark:border-slate-700"
            >
              <Plus size={15} aria-hidden="true" /> Добавить позицию
            </button>
            <button
              type="button"
              disabled={submit.isPending || activeCatalogItems.length === 0}
              onClick={submitDraft}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send size={15} aria-hidden="true" />
              {submit.isPending ? "Отправляем администратору…" : "Отправить администратору"}
            </button>
          </div>
          {activeCatalogItems.length === 0 && (
            <p className="mt-3 text-xs text-slate-500">
              В каталоге пока нет активных позиций для сметы.
            </p>
          )}
        </div>
      )}
    </section>
  );
};
