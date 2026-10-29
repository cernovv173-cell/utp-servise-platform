import type { RepairCatalogItem } from "@/lib/api";

export const itemTypeLabels = {
  SERVICE: "Услуги",
  SPARE_PART: "Запчасти",
  PRODUCT: "Товары",
} as const;

export const tracksStock = (type: RepairCatalogItem["type"]) => type !== "SERVICE";

export const defaultMinimumStockQuantity = 3;
