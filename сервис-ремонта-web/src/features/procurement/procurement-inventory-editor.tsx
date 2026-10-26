import { useMutation } from "@tanstack/react-query";
import { Boxes, Package } from "lucide-react";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";

import { type RepairCatalogItem, updateCatalogInventory } from "@/lib/api";

type InventoryItemCardProps = {
  item: RepairCatalogItem;
  token: string;
  onSaved: () => Promise<unknown> | unknown;
};

const InventoryItemCard = ({ item, token, onSaved }: InventoryItemCardProps) => {
  const [stock, setStock] = useState(String(item.stockQuantity ?? 0));
  const [minimum, setMinimum] = useState(String(item.minimumStockQuantity ?? 0));
  const update = useMutation({
    mutationFn: () =>
      updateCatalogInventory(token, item.id, {
        stockQuantity: Number(stock),
        minimumStockQuantity: Number(minimum),
      }),
    onSuccess: async () => {
      toast.success("Складские остатки сохранены.");
      await onSaved();
    },
    onError: () => toast.error("Не удалось обновить остатки."),
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate();
  };

  return (
    <SectionCard>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
          {item.type === "SPARE_PART" ? (
            <Boxes size={19} aria-hidden="true" />
          ) : (
            <Package size={19} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">
            {item.type === "SPARE_PART" ? "Запчасть" : "Товар"}
          </p>
          <h2 className="font-semibold">{item.name}</h2>
        </div>
      </div>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-medium">
          Остаток на складе
          <input
            aria-label={`Остаток на складе: ${item.name}`}
            type="number"
            min={0}
            max={2_147_483_647}
            step={1}
            required
            value={stock}
            onChange={(event) => setStock(event.currentTarget.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Минимальный запас
          <input
            aria-label={`Минимальный запас: ${item.name}`}
            type="number"
            min={0}
            max={2_147_483_647}
            step={1}
            required
            value={minimum}
            onChange={(event) => setMinimum(event.currentTarget.value)}
            className="h-10 rounded-lg border border-slate-200 bg-white px-3 font-normal dark:border-slate-700 dark:bg-slate-950"
          />
        </label>
        <button
          type="submit"
          disabled={update.isPending}
          className="min-h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2 sm:justify-self-start"
        >
          {update.isPending ? "Сохраняем…" : "Сохранить остатки"}
        </button>
      </form>
    </SectionCard>
  );
};

export const ProcurementInventoryEditor = ({
  items,
  token,
  isLoading,
  isError,
  onSaved,
}: {
  items: RepairCatalogItem[];
  token: string;
  isLoading: boolean;
  isError: boolean;
  onSaved: () => Promise<unknown> | unknown;
}) => {
  if (isLoading) return <p className="text-sm text-slate-500">Загружаем склад…</p>;
  if (isError) {
    return (
      <SectionCard>
        <p role="alert" className="text-sm text-rose-600">
          Не удалось загрузить товары и запчасти.
        </p>
      </SectionCard>
    );
  }
  if (items.length === 0) {
    return (
      <SectionCard>
        <p className="text-sm text-slate-500">Активных товаров и запчастей пока нет.</p>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {items.map((item) => (
        <InventoryItemCard
          key={`${item.id}:${item.stockQuantity ?? 0}:${item.minimumStockQuantity ?? 0}`}
          item={item}
          token={token}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
};
