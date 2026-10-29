import { ImagePlus, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";
import { ProtectedImage } from "@/components/protected-image";

import type { RepairCatalogItem } from "@/lib/api";

import { defaultMinimumStockQuantity, itemTypeLabels, tracksStock } from "./catalog-model";

type CatalogItemUpdate = Partial<
  Pick<
    RepairCatalogItem,
    | "type"
    | "name"
    | "description"
    | "unitPriceRub"
    | "stockQuantity"
    | "minimumStockQuantity"
    | "active"
  >
>;

export const CatalogItemRow = ({
  item,
  editable,
  saving,
  onSave,
  onImageUpload,
  onImageDelete,
  imageBusy,
  onDelete,
  deleteBusy,
}: {
  item: RepairCatalogItem;
  editable: boolean;
  saving: boolean;
  imageBusy: boolean;
  deleteBusy: boolean;
  onImageUpload: (file: File) => void;
  onImageDelete: (objectId: string) => void;
  onDelete: () => Promise<void>;
  onSave: (input: CatalogItemUpdate) => void;
}) => {
  const [type, setType] = useState(item.type);
  const [showEditor, setShowEditor] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    onSave({
      type,
      name: String(data.get("name")).trim(),
      ...(type === "PRODUCT"
        ? { description: String(data.get("description")).trim() || null }
        : {}),
      unitPriceRub: Number(data.get("unitPriceRub")),
      ...(tracksStock(type)
        ? {
            stockQuantity: Number(data.get("stockQuantity")),
            minimumStockQuantity: Number(data.get("minimumStockQuantity")),
          }
        : {}),
    });
    setShowEditor(false);
  };

  const confirmDelete = () => {
    void onDelete().then(
      () => setConfirmingDelete(false),
      () => undefined,
    );
  };

  return (
    <>
      <article className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-medium">{item.name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {item.unitPriceRub.toLocaleString("ru-RU")} ₽
              {tracksStock(item.type)
                ? item.stockQuantity === null
                  ? " · Остаток не задан"
                  : ` · Остаток: ${item.stockQuantity} шт.`
                : ""}
              {tracksStock(item.type) && item.stockQuantity !== null
                ? ` · Порог: ${item.minimumStockQuantity ?? defaultMinimumStockQuantity} шт.`
                : ""}
              {` · ${item.active ? "Активна" : "Скрыта"}`}
            </p>
            {item.active &&
              tracksStock(item.type) &&
              item.stockQuantity !== null &&
              (item.stockQuantity === 0 ||
                item.stockQuantity <=
                  (item.minimumStockQuantity ?? defaultMinimumStockQuantity)) && (
                <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                  {item.stockQuantity === 0
                    ? "Закончилась — пополните запас"
                    : `Мало на складе · осталось ${item.stockQuantity} шт.`}
                </p>
              )}
          </div>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowEditor((visible) => !visible)}
                className="min-h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
              >
                {showEditor ? "Закрыть" : "Изменить"}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => onSave({ active: !item.active })}
                className="min-h-9 rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
              >
                {item.active ? "Скрыть" : "Включить"}
              </button>
              <button
                type="button"
                disabled={saving || imageBusy || deleteBusy}
                onClick={() => setConfirmingDelete(true)}
                className="min-h-9 rounded-lg border border-rose-200 px-3 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950"
              >
                Удалить навсегда
              </button>
            </div>
          )}
        </div>
        {item.type === "PRODUCT" && item.description && (
          <p className="mt-3 max-w-3xl text-sm leading-6 whitespace-pre-wrap text-slate-600 dark:text-slate-300">
            {item.description}
          </p>
        )}
        {item.type === "PRODUCT" && editable && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {item.imageObjectIds.map((objectId, index) => (
              <div key={objectId} className="relative">
                <ProtectedImage
                  objectId={objectId}
                  alt={`Фото ${index + 1}: ${item.name}`}
                  className="size-20 rounded-xl object-cover"
                />
                <button
                  type="button"
                  disabled={imageBusy}
                  onClick={() => onImageDelete(objectId)}
                  aria-label={`Удалить фото ${index + 1}: ${item.name}`}
                  className="absolute -top-2 -right-2 grid size-7 place-items-center rounded-full bg-white text-rose-600 shadow hover:bg-rose-50 disabled:opacity-50 dark:bg-slate-900"
                >
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            ))}
            {item.imageObjectIds.length < 4 && (
              <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900">
                <ImagePlus size={16} aria-hidden="true" />
                {`Фото ${item.imageObjectIds.length}/4 · добавить`}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  disabled={imageBusy}
                  onChange={(event) => {
                    const file = event.currentTarget.files?.[0];
                    if (file) onImageUpload(file);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            )}
          </div>
        )}
        {showEditor && editable && (
          <form
            onSubmit={submit}
            className="mt-4 grid gap-3 border-t border-slate-100 pt-4 md:grid-cols-2 dark:border-slate-800"
          >
            <div className="flex flex-wrap gap-2 md:col-span-2">
              {(["SERVICE", "SPARE_PART", "PRODUCT"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={type === value}
                  onClick={() => setType(value)}
                  className={`min-h-9 rounded-lg border px-3 text-xs font-medium ${type === value ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300" : "border-slate-200 dark:border-slate-700"}`}
                >
                  {itemTypeLabels[value]}
                </button>
              ))}
            </div>
            <label className="grid gap-1 text-sm font-medium">
              Название
              <input
                name="name"
                defaultValue={item.name}
                required
                minLength={2}
                maxLength={160}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Цена, ₽
              <input
                name="unitPriceRub"
                type="number"
                defaultValue={item.unitPriceRub}
                min={0}
                max={10000000}
                step={1}
                required
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            {type === "PRODUCT" && (
              <label className="grid gap-1 text-sm font-medium md:col-span-2">
                Описание товара
                <textarea
                  name="description"
                  defaultValue={item.description ?? ""}
                  maxLength={2000}
                  rows={3}
                  className="resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 font-normal dark:border-slate-700 dark:bg-slate-950"
                />
              </label>
            )}
            {tracksStock(type) && (
              <>
                <label className="grid gap-1 text-sm font-medium">
                  Остаток, шт.
                  <input
                    name="stockQuantity"
                    type="number"
                    defaultValue={
                      tracksStock(item.type) && item.stockQuantity !== null
                        ? item.stockQuantity
                        : ""
                    }
                    min={0}
                    max={2147483647}
                    step={1}
                    required
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                  />
                  {tracksStock(item.type) && item.stockQuantity === null && (
                    <span className="text-xs font-normal text-slate-500">
                      Учёт остатка ещё не настроен — укажите фактическое количество.
                    </span>
                  )}
                </label>
                <label className="grid gap-1 text-sm font-medium">
                  Минимальный остаток для сигнала, шт.
                  <input
                    name="minimumStockQuantity"
                    type="number"
                    defaultValue={
                      tracksStock(item.type)
                        ? (item.minimumStockQuantity ?? defaultMinimumStockQuantity)
                        : defaultMinimumStockQuantity
                    }
                    min={0}
                    max={2147483647}
                    step={1}
                    required
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                  />
                  <span className="text-xs font-normal text-slate-500">
                    0 — сигнал только при нулевом остатке.
                  </span>
                </label>
              </>
            )}
            <button
              type="submit"
              disabled={saving}
              className="min-h-10 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2 md:justify-self-start"
            >
              Сохранить изменения
            </button>
          </form>
        )}
      </article>

      <Modal open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <ModalContent>
          <ModalHeader>
            <ModalTitle>Удалить позицию навсегда?</ModalTitle>
            <ModalDescription>
              «{item.name}» исчезнет из каталога. Удаление невозможно отменить.{" "}
              {tracksStock(item.type) && "Остаток должен быть нулевым. "}Позиция не должна входить в
              незавершённый ремонт, ожидающую смету или ожидающий/подтверждённый заказ магазина.
              История закрытых заказов и сохранённые в ней цены останутся.
            </ModalDescription>
          </ModalHeader>
          <ModalFooter>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={() => setConfirmingDelete(false)}
              className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
            >
              Отмена
            </button>
            <button
              type="button"
              disabled={deleteBusy}
              onClick={confirmDelete}
              className="min-h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-60"
            >
              {deleteBusy ? "Удаляем…" : "Удалить навсегда"}
            </button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </>
  );
};
