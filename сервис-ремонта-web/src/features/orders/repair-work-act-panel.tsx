import { useMutation } from "@tanstack/react-query";
import { Check, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Select } from "@/components/select";

import { useAuth } from "@/features/auth/auth-context";

import {
  type RepairCatalogItem,
  type RepairDeviceType,
  type RepairOrder,
  type RepairWorkActLine,
  reviewRepairWorkAct,
  saveRepairWorkAct,
  submitRepairWorkAct,
} from "@/lib/api";

const itemTypeLabels = {
  SERVICE: "Работа",
  SPARE_PART: "Запчасть",
  PRODUCT: "Товар",
} as const;

const money = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

const linesFromOrder = (order: RepairOrder): RepairWorkActLine[] =>
  order.items.map((item) => ({
    lineId: item.id,
    orderItemId: item.id,
    catalogItemId: item.catalogItemId ?? null,
    type: item.type,
    name: item.name,
    quantity: item.quantity,
    unitPriceRub: item.unitPriceRub,
  }));

const linesForAct = (act: NonNullable<RepairOrder["workAct"]>): RepairWorkActLine[] =>
  act.status === "APPROVED" ? (act.approvedItemsSnapshot ?? []) : act.itemsSnapshot;

export const RepairWorkActPanel = (props: {
  order: RepairOrder;
  token: string;
  catalogItems: RepairCatalogItem[];
  onRefresh: () => Promise<unknown>;
}) => {
  const act = props.order.workAct ?? null;
  const key = [
    props.order.id,
    props.order.status,
    act?.id ?? "no-act",
    act?.revision ?? 0,
    act?.status ?? "none",
    props.order.items.map((item) => `${item.id}:${item.quantity}`).join(","),
  ].join(":");

  return <RepairWorkActPanelContent key={key} {...props} />;
};

const RepairWorkActPanelContent = ({
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
  const act = order.workAct ?? null;
  const isAdmin = user?.role === "ADMIN";
  const isAssignedTechnician =
    user?.role === "TECHNICIAN" && order.assignedTechnicianId === user.id;
  const canManage = isAdmin || isAssignedTechnician;
  const [draftLines, setDraftLines] = useState<RepairWorkActLine[]>(() =>
    act ? linesForAct(act) : linesFromOrder(order),
  );
  const [catalogItemId, setCatalogItemId] = useState("");
  const [includedLineIds, setIncludedLineIds] = useState<string[]>(() =>
    act?.status === "PENDING" ? act.itemsSnapshot.map((line) => line.lineId) : [],
  );

  const activeCatalogItems = catalogItems.filter(
    (item) =>
      item.active &&
      (item.type === "PRODUCT" || item.deviceTypes.includes(order.deviceType as RepairDeviceType)),
  );
  const save = useMutation({
    mutationFn: () =>
      saveRepairWorkAct(token, order.id, {
        expectedRevision: act?.revision ?? 0,
        items: draftLines.map(({ lineId, orderItemId, catalogItemId: id, quantity }) => ({
          lineId,
          orderItemId,
          catalogItemId: id,
          quantity,
        })),
      }),
    onSuccess: async () => {
      toast.success("Черновик акта сохранён. Строки пока не влияют на чек и склад.");
      await onRefresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить акт."),
  });
  const submit = useMutation({
    mutationFn: async () => {
      const saved = await saveRepairWorkAct(token, order.id, {
        expectedRevision: act?.revision ?? 0,
        items: draftLines.map(({ lineId, orderItemId, catalogItemId: id, quantity }) => ({
          lineId,
          orderItemId,
          catalogItemId: id,
          quantity,
        })),
      });
      return submitRepairWorkAct(token, order.id, saved.workAct.revision);
    },
    onSuccess: async () => {
      toast.success(
        "Акт передан администратору. Он подтвердит итоговые строки без согласования с мастером.",
      );
      await onRefresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось передать акт."),
  });
  const review = useMutation({
    mutationFn: () => reviewRepairWorkAct(token, order.id, act!.revision, includedLineIds),
    onSuccess: async () => {
      toast.success("Акт подтверждён. Выбранные строки включены в итог заявки.");
      await onRefresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось подтвердить акт."),
  });

  if (!canManage && !act) return null;
  if (!canManage && act?.status !== "APPROVED") return null;

  const actLines = act ? linesForAct(act) : [];
  const total = (lines: readonly RepairWorkActLine[]) =>
    lines.reduce((sum, line) => sum + line.quantity * line.unitPriceRub, 0);
  const addCatalogLine = () => {
    const item = activeCatalogItems.find((candidate) => candidate.id === catalogItemId);
    if (!item) return;
    setDraftLines((current) => [
      ...current,
      {
        lineId: globalThis.crypto.randomUUID(),
        orderItemId: null,
        catalogItemId: item.id,
        type: item.type,
        name: item.name,
        quantity: 1,
        unitPriceRub: item.unitPriceRub,
      },
    ]);
    setCatalogItemId("");
  };

  return (
    <section className="mt-4 rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-wide text-violet-800 uppercase dark:text-violet-200">
            Фактические работы
          </p>
          <h3 className="mt-1 text-base font-semibold">Акт выполненных работ</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-600 dark:text-slate-300">
            Мастер добавляет позиции без предварительного согласования. До подтверждения
            администратором черновик не меняет чек, склад или расчёт мастера.
          </p>
        </div>
        {act && (
          <span className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-semibold text-violet-900 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-100">
            {act.status === "DRAFT"
              ? "Черновик"
              : act.status === "PENDING"
                ? "На проверке"
                : "Подтверждён"}
          </span>
        )}
      </div>

      {!act && order.status !== "IN_PROGRESS" && order.workActRequired && (
        <p className="mt-3 rounded-xl bg-white p-3 text-xs leading-5 text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          После начала ремонта мастер добавит выполненные работы в акт. Для новой заявки
          администратор должен подтвердить акт перед выдачей.
        </p>
      )}

      {act && (act.status === "PENDING" || act.status === "APPROVED") && (
        <div className="mt-4 grid gap-2">
          {(act.status === "PENDING" ? act.itemsSnapshot : actLines).map((line) => {
            const included = includedLineIds.includes(line.lineId);
            return (
              <div
                key={line.lineId}
                className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm dark:bg-slate-950"
              >
                {act.status === "PENDING" && isAdmin && (
                  <input
                    type="checkbox"
                    checked={included}
                    aria-label={`${included ? "Оставить" : "Удалить"} из акта: ${line.name}`}
                    onChange={(event) =>
                      setIncludedLineIds((current) =>
                        event.target.checked
                          ? [...current, line.lineId]
                          : current.filter((id) => id !== line.lineId),
                      )
                    }
                    className="size-4 accent-violet-700"
                  />
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{line.name}</p>
                  <p className="text-xs text-slate-500">
                    {itemTypeLabels[line.type]} · {line.quantity} × {money(line.unitPriceRub)}
                  </p>
                </div>
                <strong>{money(line.quantity * line.unitPriceRub)}</strong>
              </div>
            );
          })}
          <p className="flex justify-between border-t border-violet-200 pt-3 text-sm font-semibold dark:border-violet-900">
            <span>{act.status === "PENDING" && isAdmin ? "Итого выбранных строк" : "Итого"}</span>
            <span>
              {money(
                total(
                  act.status === "PENDING"
                    ? act.itemsSnapshot.filter((line) => includedLineIds.includes(line.lineId))
                    : actLines,
                ),
              )}
            </span>
          </p>
          {act.status === "PENDING" && (
            <p className="text-xs text-slate-500">
              {isAdmin
                ? "Снимите отметки у строк, которые нужно удалить. Подтверждение сразу зафиксирует выбранный состав."
                : "Акт передан администратору. После его подтверждения мастер не должен отдельно соглашаться с удалёнными строками."}
            </p>
          )}
          {act.status === "PENDING" && isAdmin && (
            <button
              type="button"
              disabled={review.isPending}
              onClick={() => review.mutate()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Check size={16} aria-hidden="true" />
              {review.isPending ? "Подтверждаем…" : "Подтвердить акт"}
            </button>
          )}
          {act.status === "APPROVED" && act.approvedBy && (
            <p className="text-xs text-slate-500">
              Подтвердил(а): {act.approvedBy.displayName}
              {act.approvedAt ? ` · ${new Date(act.approvedAt).toLocaleString("ru-RU")}` : ""}
            </p>
          )}
          {act.status === "APPROVED" && (act.removedItemsSnapshot?.length ?? 0) > 0 && (
            <details className="rounded-xl bg-white p-3 text-xs dark:bg-slate-950">
              <summary className="cursor-pointer font-semibold">
                Удалённые администратором строки ({act.removedItemsSnapshot!.length})
              </summary>
              <ul className="mt-2 grid gap-1 text-slate-500">
                {act.removedItemsSnapshot!.map((line) => (
                  <li key={line.lineId}>
                    {line.name} · {line.quantity} × {money(line.unitPriceRub)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {act?.status === "DRAFT" && (
        <div className="mt-4 grid gap-3">
          <p className="text-xs text-slate-500">
            Исходные строки сметы сохранены. Мастер может добавлять фактически выполненные работы и
            запчасти; удалять исходные строки будет решать администратор.
          </p>
          {draftLines.map((line) => (
            <div
              key={line.lineId}
              className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-3 text-sm dark:bg-slate-950"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium">{line.name}</p>
                <p className="text-xs text-slate-500">
                  {itemTypeLabels[line.type]} · {line.quantity} × {money(line.unitPriceRub)}
                </p>
              </div>
              {!line.orderItemId && (
                <label className="text-xs text-slate-500">
                  Количество
                  <input
                    aria-label={`Количество: ${line.name}`}
                    type="number"
                    min={1}
                    max={99}
                    value={line.quantity || ""}
                    onChange={(event) =>
                      setDraftLines((current) =>
                        current.map((item) =>
                          item.lineId === line.lineId
                            ? { ...item, quantity: Number(event.target.value) }
                            : item,
                        ),
                      )
                    }
                    className="ml-2 h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                  />
                </label>
              )}
              <strong>{money(line.quantity * line.unitPriceRub)}</strong>
              {!line.orderItemId && (
                <button
                  type="button"
                  aria-label={`Убрать добавленную строку ${line.name}`}
                  onClick={() =>
                    setDraftLines((current) =>
                      current.filter((item) => item.lineId !== line.lineId),
                    )
                  }
                  className="grid size-9 place-items-center rounded-lg border border-rose-200 text-rose-700 dark:border-rose-900 dark:text-rose-300"
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
          <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
            <Select
              ariaLabel="Добавить работу или запчасть в акт"
              value={catalogItemId}
              onValueChange={setCatalogItemId}
              placeholder="Выберите позицию из каталога"
              options={activeCatalogItems.map((item) => ({
                value: item.id,
                label: `${itemTypeLabels[item.type]} · ${item.name} · ${money(item.unitPriceRub)}${item.stockQuantity === null ? "" : ` · остаток ${item.stockQuantity}`}`,
              }))}
              className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
            <button
              type="button"
              disabled={!catalogItemId || draftLines.length >= 100}
              onClick={addCatalogLine}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-violet-200 px-4 text-xs font-semibold disabled:opacity-50 dark:border-violet-800"
            >
              <Plus size={15} aria-hidden="true" /> Добавить строку
            </button>
          </div>
          <p className="text-right text-sm font-semibold">
            Итого в черновике: {money(total(draftLines))}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                save.isPending ||
                !draftLines.length ||
                draftLines.some(
                  (line) =>
                    !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99,
                )
              }
              onClick={() => save.mutate()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold disabled:opacity-50 dark:border-slate-700"
            >
              Сохранить черновик
            </button>
            <button
              type="button"
              disabled={
                submit.isPending ||
                !draftLines.length ||
                draftLines.some(
                  (line) =>
                    !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 99,
                )
              }
              onClick={() => submit.mutate()}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-violet-700 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Send size={15} aria-hidden="true" />
              {submit.isPending ? "Передаём…" : "Передать администратору"}
            </button>
          </div>
        </div>
      )}

      {act?.status === "DRAFT" && isAdmin && (
        <p className="mt-3 text-xs text-slate-500">
          Мастер ещё не передал акт на подтверждение. Подтвердить черновик нельзя.
        </p>
      )}
    </section>
  );
};
