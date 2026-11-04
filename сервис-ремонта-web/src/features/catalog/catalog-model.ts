import type { RepairCatalogItem, RepairDeviceType } from "@/lib/api";

export const itemTypeLabels = {
  SERVICE: "Услуги",
  SPARE_PART: "Запчасти",
  PRODUCT: "Товары",
} as const;

export const tracksStock = (type: RepairCatalogItem["type"]) => type !== "SERVICE";

export const repairDeviceTypes: RepairDeviceType[] = ["COMPUTER", "LAPTOP", "PHONE", "TABLET"];

export const repairDeviceTypeLabels: Record<RepairDeviceType, string> = {
  COMPUTER: "ПК",
  LAPTOP: "Ноутбук",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

export const defaultMinimumStockQuantity = 3;
