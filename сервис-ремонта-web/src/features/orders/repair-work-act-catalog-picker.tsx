import { Plus, Search, Star } from "lucide-react";
import { useId, useMemo, useState } from "react";

import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/modal";

import type { RepairCatalogItem } from "@/lib/api";

import {
  type RepairWorkActCatalogMode,
  type RepairWorkActCatalogTypeFilter,
  filterRepairWorkActCatalogItems,
} from "./repair-work-act-catalog-shortcuts";

const typeLabels: Record<RepairCatalogItem["type"], string> = {
  SERVICE: "Работа",
  SPARE_PART: "Запчасть",
  PRODUCT: "Товар",
};

const modeOptions: { value: RepairWorkActCatalogMode; label: string }[] = [
  { value: "ALL", label: "Весь каталог" },
  { value: "FAVORITES", label: "Избранное" },
  { value: "RECENT", label: "Недавние" },
];

const typeOptions: { value: RepairWorkActCatalogTypeFilter; label: string }[] = [
  { value: "ALL", label: "Все" },
  { value: "SERVICE", label: "Работы" },
  { value: "SPARE_PART", label: "Запчасти" },
  { value: "PRODUCT", label: "Товары" },
];

export const RepairWorkActCatalogPicker = ({
  open,
  items,
  favoriteIds,
  recentIds,
  onOpenChange,
  onAdd,
  onToggleFavorite,
}: {
  open: boolean;
  items: RepairCatalogItem[];
  favoriteIds: string[];
  recentIds: string[];
  onOpenChange: (open: boolean) => void;
  onAdd: (item: RepairCatalogItem) => void;
  onToggleFavorite: (itemId: string) => void;
}) => {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<RepairWorkActCatalogMode>("ALL");
  const [typeFilter, setTypeFilter] = useState<RepairWorkActCatalogTypeFilter>("ALL");
  const searchId = useId();
  const filteredItems = useMemo(
    () =>
      filterRepairWorkActCatalogItems(items, { mode, typeFilter, query, favoriteIds, recentIds }),
    [favoriteIds, items, mode, query, recentIds, typeFilter],
  );

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="p-4 sm:p-5">
        <ModalHeader>
          <ModalTitle>Добавить позицию в акт</ModalTitle>
          <ModalDescription>
            Выберите работу или запчасть. Позиция останется в черновике и попадёт в чек только после
            одобрения администратора.
          </ModalDescription>
        </ModalHeader>

        <div className="relative mt-4">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400"
          />
          <label className="sr-only" htmlFor={searchId}>
            Поиск по названию или описанию
          </label>
          <input
            autoComplete="off"
            className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-10 text-sm outline-none focus-visible:ring-2 focus-visible:ring-violet-600 dark:border-slate-700 dark:bg-slate-950"
            id={searchId}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию или описанию"
            type="search"
            value={query}
          />
        </div>

        <div aria-label="Быстрый список каталога" className="mt-3 flex flex-wrap gap-2">
          {modeOptions.map((option) => (
            <button
              aria-pressed={mode === option.value}
              className={`min-h-9 rounded-full border px-3 text-xs font-semibold transition-colors ${
                mode === option.value
                  ? "border-violet-700 bg-violet-700 text-white"
                  : "border-slate-200 bg-white text-slate-700 hover:border-violet-300 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              }`}
              key={option.value}
              onClick={() => setMode(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div aria-label="Тип позиции" className="mt-2 flex flex-wrap gap-2">
          {typeOptions.map((option) => (
            <button
              aria-pressed={typeFilter === option.value}
              className={`min-h-8 rounded-lg px-2.5 text-xs transition-colors ${
                typeFilter === option.value
                  ? "bg-violet-100 font-semibold text-violet-900 dark:bg-violet-950 dark:text-violet-100"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
              key={option.value}
              onClick={() => setTypeFilter(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>

        <div aria-live="polite" className="mt-3 max-h-[min(48dvh,28rem)] overflow-y-auto pr-1">
          {filteredItems.length === 0 ? (
            <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              {mode === "FAVORITES" && favoriteIds.length === 0
                ? "Пока нет избранных позиций. Нажмите на звёздочку у нужной работы или запчасти."
                : mode === "RECENT" && recentIds.length === 0
                  ? "Недавние позиции появятся здесь после добавления в акт."
                  : "По этому запросу ничего не найдено."}
            </p>
          ) : (
            <ul className="grid gap-2">
              {filteredItems.map((item) => {
                const isFavorite = favoriteIds.includes(item.id);
                return (
                  <li
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-950"
                    key={item.id}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {typeLabels[item.type]} · {item.unitPriceRub.toLocaleString("ru-RU")} ₽
                        {item.stockQuantity === null
                          ? ""
                          : item.stockQuantity > 0
                            ? ` · остаток ${item.stockQuantity}`
                            : " · нет в наличии, можно передать на согласование"}
                      </p>
                    </div>
                    <button
                      aria-label={`${isFavorite ? "Убрать из" : "Добавить в"} избранное: ${item.name}`}
                      aria-pressed={isFavorite}
                      className="grid size-9 shrink-0 place-items-center rounded-lg text-amber-600 hover:bg-amber-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 dark:hover:bg-slate-900"
                      onClick={() => onToggleFavorite(item.id)}
                      type="button"
                    >
                      <Star
                        aria-hidden="true"
                        className="size-4"
                        fill={isFavorite ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      aria-label={`Добавить ${item.name} в акт`}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700"
                      onClick={() => onAdd(item)}
                      type="button"
                    >
                      <Plus aria-hidden="true" className="size-3.5" /> Добавить
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </ModalContent>
    </Modal>
  );
};
