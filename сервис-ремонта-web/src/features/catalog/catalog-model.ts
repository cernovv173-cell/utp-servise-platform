import type { RepairCatalogItem, RepairCatalogServiceCategory, RepairDeviceType } from "@/lib/api";

export const itemTypeLabels = {
  SERVICE: "Услуги",
  SPARE_PART: "Запчасти",
  PRODUCT: "Товары",
} as const;

export const tracksStock = (type: RepairCatalogItem["type"]) => type !== "SERVICE";

export const repairDeviceTypes: RepairDeviceType[] = ["COMPUTER", "LAPTOP", "MONOBLOCK"];

export const repairDeviceTypeLabels: Record<string, string> = {
  COMPUTER: "ПК",
  LAPTOP: "Ноутбук",
  MONOBLOCK: "Моноблок",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

export const repairDeviceTypeLabel = (deviceType: string) =>
  repairDeviceTypeLabels[deviceType] ?? deviceType;

export const repairServiceCategoryLabels: Record<RepairCatalogServiceCategory, string> = {
  SOFTWARE: "ПО",
};

export const defaultMinimumStockQuantity = 3;
