import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";
import { Select } from "@/components/select";

import { useAuth } from "@/features/auth/auth-context";
import {
  type ProcurementSupplier,
  createStockReceipt,
} from "@/features/procurement/procurement-api";

import type { RepairCatalogItem } from "@/lib/api";

type StockReceiptDialogProps = {
  items: RepairCatalogItem[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  preselectedItemId?: string;
  suppliers: ProcurementSupplier[];
};

const rubles = new Intl.NumberFormat("ru-RU");

export const StockReceiptDialog = ({
  items,
  onOpenChange,
  open,
  preselectedItemId,
  suppliers,
}: StockReceiptDialogProps) => {
  const { token } = useAuth();
  const queryClient = useQueryClient();
  const purchasableItems = useMemo(
    () => items.filter((item) => item.active && item.type !== "SERVICE"),
    [items],
  );
  const activeSuppliers = useMemo(
    () => suppliers.filter((supplier) => supplier.isActive),
    [suppliers],
  );
  const [itemId, setItemId] = useState(preselectedItemId ?? "");
  const [supplierId, setSupplierId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [unitCost, setUnitCost] = useState("");
  const [documentReference, setDocumentReference] = useState("");
  const selectedItem = purchasableItems.find((item) => item.id === itemId);
  const trackedItems = purchasableItems.filter((item) => item.stockQuantity !== null);
  const selectedSupplierId = activeSuppliers.some((supplier) => supplier.id === supplierId)
    ? supplierId
    : (activeSuppliers[0]?.id ?? "");

  const create = useMutation({
    mutationFn: () =>
      createStockReceipt(token!, {
        supplierId: selectedSupplierId,
        catalogItemId: itemId,
        quantity: Number(quantity),
        unitCostRub: unitCost.trim() ? Number(unitCost) : null,
        documentReference: documentReference.trim() || null,
      }),
    onSuccess: async () => {
      toast.success("Поступление записано, складской остаток увеличен.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["stock-receipts", token] }),
        queryClient.invalidateQueries({ queryKey: ["procurement-list", token] }),
        queryClient.invalidateQueries({ queryKey: ["repair-catalog", token] }),
      ]);
      onOpenChange(false);
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось записать поступление."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedSupplierId || !itemId) return;
    create.mutate();
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Оформить поступление</ModalTitle>
          <ModalDescription>
            Выберите поставщика и позицию. Количество будет добавлено к текущему остатку, а запись
            сохранится в истории закупок.
          </ModalDescription>
        </ModalHeader>
        <form className="mt-5 grid gap-4" onSubmit={submit}>
          <label className="grid gap-1.5 text-sm font-medium">
            Поставщик
            <Select
              ariaLabel="Поставщик"
              disabled={activeSuppliers.length === 0}
              onValueChange={setSupplierId}
              options={activeSuppliers.map((supplier) => ({
                value: supplier.id,
                label: supplier.name,
              }))}
              placeholder="Выберите поставщика"
              value={selectedSupplierId}
            />
            {activeSuppliers.length === 0 && (
              <span className="text-xs font-normal text-amber-700 dark:text-amber-300">
                Сначала добавьте или включите поставщика в списке ниже.
              </span>
            )}
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Товар или запчасть
            <Select
              ariaLabel="Товар или запчасть"
              disabled={trackedItems.length === 0}
              onValueChange={setItemId}
              options={purchasableItems.map((item) => ({
                value: item.id,
                label: `${item.type === "SPARE_PART" ? "Запчасть" : "Товар"} · ${item.name}${
                  item.stockQuantity === null ? " · остаток не задан" : ""
                }`,
                disabled: item.stockQuantity === null,
              }))}
              placeholder="Выберите позицию"
              value={itemId}
            />
            {purchasableItems.some((item) => item.stockQuantity === null) && (
              <span className="text-xs font-normal text-slate-500">
                Для позиций без учёта остатка сначала укажите фактическое количество в каталоге.
              </span>
            )}
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              Количество
              <input
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                min={1}
                max={2_147_483_647}
                onChange={(event) => setQuantity(event.currentTarget.value)}
                required
                step={1}
                type="number"
                value={quantity}
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              Цена закупки за единицу, ₽{" "}
              <span className="font-normal text-slate-500">(необязательно)</span>
              <input
                className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
                min={0}
                max={2_147_483_647}
                onChange={(event) => setUnitCost(event.currentTarget.value)}
                step={1}
                type="number"
                value={unitCost}
              />
            </label>
          </div>
          <label className="grid gap-1.5 text-sm font-medium">
            Номер накладной или комментарий{" "}
            <span className="font-normal text-slate-500">(необязательно)</span>
            <input
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
              maxLength={120}
              onChange={(event) => setDocumentReference(event.currentTarget.value)}
              value={documentReference}
            />
          </label>
          {selectedItem && selectedItem.stockQuantity !== null && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              После поступления на складе будет{" "}
              {rubles.format(selectedItem.stockQuantity + (Number(quantity) || 0))} шт.
            </p>
          )}
          <ModalFooter>
            <button
              className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold dark:border-slate-700"
              disabled={create.isPending}
              onClick={() => onOpenChange(false)}
              type="button"
            >
              Отмена
            </button>
            <button
              className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
              disabled={
                create.isPending ||
                !selectedSupplierId ||
                !selectedItem ||
                selectedItem.stockQuantity === null ||
                Number(quantity) < 1
              }
              type="submit"
            >
              {create.isPending ? "Записываем…" : "Подтвердить поступление"}
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
};
