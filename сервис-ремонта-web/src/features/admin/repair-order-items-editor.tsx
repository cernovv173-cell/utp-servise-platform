import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { Select } from "@/components/select";

import {
  type RepairCatalogItem,
  type RepairDeviceType,
  type RepairOrder,
  addRepairOrderItem,
  removeRepairOrderItem,
  updateRepairOrderItemQuantity,
} from "@/lib/api";

const itemTypeLabels = {
  SERVICE: "Услуга",
  SPARE_PART: "Запчасть",
  PRODUCT: "Товар",
} as const;

const ItemQuantityRow = ({
  order,
  item,
  token,
  canEdit,
  onRefresh,
}: {
  order: RepairOrder;
  item: RepairOrder["items"][number];
  token: string;
  canEdit: boolean;
  onRefresh: () => Promise<unknown>;
}) => {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const update = useMutation({
    mutationFn: (nextQuantity: number) =>
      updateRepairOrderItemQuantity(token, order.id, item.id, nextQuantity),
    onSuccess: async (_result, nextQuantity) => {
      setQuantity(String(nextQuantity));
      await onRefresh();
      toast.success("Количество обновлено.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить количество."),
  });
  const remove = useMutation({
    mutationFn: () => removeRepairOrderItem(token, order.id, item.id),
    onSuccess: async () => {
      await onRefresh();
      toast.success("Позиция удалена из заказа.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось удалить позицию."),
  });

  const saveQuantity = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    if (!Number.isInteger(parsedQuantity) || parsedQuantity < 1 || parsedQuantity > 99) {
      toast.error("Укажите количество от 1 до 99.");
      return;
    }
    if (parsedQuantity !== item.quantity) update.mutate(parsedQuantity);
  };

  return (
    <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center dark:bg-slate-900">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {itemTypeLabels[item.type]}
          </span>
          <span className="text-xs font-semibold">{item.name}</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {item.unitPriceRub.toLocaleString("ru-RU")} ₽ за единицу · итого{" "}
          {(item.unitPriceRub * item.quantity).toLocaleString("ru-RU")} ₽
        </p>
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={saveQuantity} className="flex items-center gap-2">
            <label className="sr-only" htmlFor={`order-item-quantity-${item.id}`}>
              Количество: {item.name}
            </label>
            <input
              id={`order-item-quantity-${item.id}`}
              aria-label={`Количество: ${item.name}`}
              type="number"
              min={1}
              max={99}
              step={1}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="h-9 w-20 rounded-lg border border-slate-200 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
            />
            <button
              type="submit"
              disabled={update.isPending || remove.isPending || Number(quantity) === item.quantity}
              className="min-h-9 rounded-lg border border-slate-200 px-3 text-xs font-semibold disabled:opacity-50 dark:border-slate-700"
            >
              Сохранить
            </button>
          </form>
          <button
            type="button"
            disabled={update.isPending || remove.isPending}
            aria-label={`Удалить позицию ${item.name}`}
            title="Удалить позицию"
            onClick={() => {
              if (window.confirm(`Удалить позицию «${item.name}» из заказа?`)) remove.mutate();
            }}
            className="grid size-9 place-items-center rounded-lg border border-rose-200 text-rose-700 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <p className="text-xs font-medium text-slate-600 dark:text-slate-300">
          Количество: {item.quantity}
        </p>
      )}
    </div>
  );
};

export const RepairOrderItemsEditor = ({
  order,
  token,
  catalogItems,
  canEdit,
  canAdd = canEdit,
  showEditHint = true,
  isCatalogLoading,
  isCatalogError,
  onRefresh,
}: {
  order: RepairOrder;
  token: string;
  catalogItems: RepairCatalogItem[];
  canEdit: boolean;
  canAdd?: boolean;
  showEditHint?: boolean;
  isCatalogLoading: boolean;
  isCatalogError: boolean;
  onRefresh: () => Promise<unknown>;
}) => {
  const estimateControlsItems = Boolean(order.estimates?.length);
  const canEditApprovedComposition = canEdit && !estimateControlsItems;
  const canAddDirectly = canAdd && !estimateControlsItems;
  const [catalogItemId, setCatalogItemId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const add = useMutation({
    mutationFn: () => addRepairOrderItem(token, order.id, catalogItemId, Number(quantity)),
    onSuccess: async () => {
      await onRefresh();
      setCatalogItemId("");
      setQuantity("1");
      toast.success("Позиция добавлена в заказ.");
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось добавить позицию."),
  });
  const availableItems = catalogItems.filter(
    (item) =>
      item.active &&
      (item.type === "PRODUCT" || item.deviceTypes.includes(order.deviceType as RepairDeviceType)),
  );

  const addItem = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedQuantity = Number(quantity);
    if (
      !catalogItemId ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 1 ||
      parsedQuantity > 99
    ) {
      toast.error("Выберите позицию и укажите количество от 1 до 99.");
      return;
    }
    add.mutate();
  };

  return (
    <section className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
      <h4 className="text-sm font-semibold">Состав заказа</h4>
      {order.items.length > 0 ? (
        <div className="mt-3 grid gap-2">
          {order.items.map((item) => (
            <ItemQuantityRow
              key={`${item.id}-${item.quantity}`}
              order={order}
              item={item}
              token={token}
              canEdit={canEditApprovedComposition}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      ) : (
        <p className="mt-2 text-xs text-slate-500">В заказе пока нет услуг или товаров.</p>
      )}
      {order.items.length > 0 && (
        <p className="mt-3 text-xs font-semibold text-slate-700 dark:text-slate-300">
          Итого по позициям:{" "}
          {order.items
            .reduce((sum, item) => sum + item.quantity * item.unitPriceRub, 0)
            .toLocaleString("ru-RU")}{" "}
          ₽
        </p>
      )}
      {canAddDirectly && (
        <form onSubmit={addItem} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_auto]">
          <Select
            ariaLabel="Услуга, запчасть или товар для заказа"
            value={catalogItemId}
            onValueChange={setCatalogItemId}
            placeholder="Выберите позицию из каталога"
            options={availableItems.map((item) => ({
              value: item.id,
              label: `${itemTypeLabels[item.type]} · ${item.name} · ${item.unitPriceRub.toLocaleString("ru-RU")} ₽${item.stockQuantity === null ? "" : ` · остаток ${item.stockQuantity}`}`,
            }))}
            className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          />
          <label className="sr-only" htmlFor={`new-order-item-quantity-${order.id}`}>
            Количество новой позиции
          </label>
          <input
            id={`new-order-item-quantity-${order.id}`}
            type="number"
            min={1}
            max={99}
            step={1}
            value={quantity}
            onChange={(event) => setQuantity(event.target.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
          />
          <button
            type="submit"
            disabled={add.isPending || availableItems.length === 0}
            className="min-h-10 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
          >
            {add.isPending ? "Добавляем…" : "Добавить позицию"}
          </button>
          {isCatalogLoading && (
            <p className="text-xs text-slate-500 sm:col-span-3">Загружаем каталог…</p>
          )}
          {isCatalogError && (
            <p role="alert" className="text-xs text-rose-600 sm:col-span-3">
              Не удалось загрузить каталог. Обновите страницу и попробуйте снова.
            </p>
          )}
          {!isCatalogLoading && !isCatalogError && availableItems.length === 0 && (
            <p className="text-xs text-slate-500 sm:col-span-3">
              В каталоге нет активных услуг, запчастей или товаров.
            </p>
          )}
        </form>
      )}
      {canAdd && estimateControlsItems && (
        <p className="mt-3 text-xs leading-5 text-slate-500">
          Состав уже подтверждён администратором. Дополнительные работы оформляйте отдельной сметой
          на проверку администратора.
        </p>
      )}
      {showEditHint && !canEdit && order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
        <p className="mt-3 text-xs text-slate-500">
          Нажмите «Редактировать», чтобы изменить состав заказа.
        </p>
      )}
    </section>
  );
};
