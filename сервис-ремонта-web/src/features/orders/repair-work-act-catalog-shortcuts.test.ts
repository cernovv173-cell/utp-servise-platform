import { describe, expect, it } from "vitest";

import type { RepairCatalogItem } from "@/lib/api";

import {
  filterRepairWorkActCatalogItems,
  readRepairWorkActCatalogShortcuts,
  recordRecentRepairCatalogItem,
  saveRepairWorkActCatalogShortcuts,
  toggleRepairCatalogFavorite,
} from "./repair-work-act-catalog-shortcuts";

const catalogItems: RepairCatalogItem[] = [
  {
    id: "service-clean",
    type: "SERVICE",
    name: "Чистка ноутбука",
    description: "Чистка системы охлаждения",
    serviceCategory: null,
    deviceTypes: ["LAPTOP"],
    imageObjectIds: [],
    unitPriceRub: 1200,
    stockQuantity: null,
    minimumStockQuantity: null,
    active: true,
  },
  {
    id: "part-fan",
    type: "SPARE_PART",
    name: "Вентилятор",
    description: null,
    serviceCategory: null,
    deviceTypes: ["LAPTOP"],
    imageObjectIds: [],
    unitPriceRub: 1800,
    stockQuantity: 4,
    minimumStockQuantity: 1,
    active: true,
  },
  {
    id: "product-bag",
    type: "PRODUCT",
    name: "Сумка",
    description: null,
    serviceCategory: null,
    deviceTypes: [],
    imageObjectIds: [],
    unitPriceRub: 900,
    stockQuantity: 2,
    minimumStockQuantity: 1,
    active: true,
  },
];

const softwareService: RepairCatalogItem = {
  id: "service-windows",
  type: "SERVICE",
  name: "Установка Windows 11",
  description: null,
  serviceCategory: "SOFTWARE",
  deviceTypes: ["MONOBLOCK"],
  imageObjectIds: [],
  unitPriceRub: 2700,
  stockQuantity: null,
  minimumStockQuantity: null,
  active: true,
};

const createMemoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
};

describe("repair work-act catalog shortcuts", () => {
  it("filters catalog by search text, item type, favorites, and recent order", () => {
    expect(
      filterRepairWorkActCatalogItems(catalogItems, {
        mode: "ALL",
        typeFilter: "SERVICE",
        query: "охлаждения",
        favoriteIds: [],
        recentIds: [],
      }).map((item) => item.id),
    ).toEqual(["service-clean"]);

    expect(
      filterRepairWorkActCatalogItems(catalogItems, {
        mode: "FAVORITES",
        typeFilter: "ALL",
        query: "",
        favoriteIds: ["part-fan", "service-clean"],
        recentIds: [],
      }).map((item) => item.id),
    ).toEqual(["part-fan", "service-clean"]);

    expect(
      filterRepairWorkActCatalogItems(catalogItems, {
        mode: "RECENT",
        typeFilter: "ALL",
        query: "",
        favoriteIds: [],
        recentIds: ["product-bag", "part-fan"],
      }).map((item) => item.id),
    ).toEqual(["product-bag", "part-fan"]);
  });

  it("keeps software services in their own catalog group", () => {
    expect(
      filterRepairWorkActCatalogItems([softwareService, ...catalogItems], {
        mode: "ALL",
        typeFilter: "SOFTWARE",
        query: "",
        favoriteIds: [],
        recentIds: [],
      }).map((item) => item.id),
    ).toEqual(["service-windows"]);

    expect(
      filterRepairWorkActCatalogItems([softwareService, ...catalogItems], {
        mode: "ALL",
        typeFilter: "SERVICE",
        query: "",
        favoriteIds: [],
        recentIds: [],
      }).map((item) => item.id),
    ).toEqual(["service-clean"]);
  });

  it("keeps favorites and recent items independent for each signed-in user", () => {
    const storage = createMemoryStorage();
    saveRepairWorkActCatalogShortcuts(
      "technician-1",
      { favoriteIds: ["part-fan"], recentIds: ["service-clean"] },
      storage,
    );

    expect(readRepairWorkActCatalogShortcuts("technician-1", storage)).toEqual({
      favoriteIds: ["part-fan"],
      recentIds: ["service-clean"],
    });
    expect(readRepairWorkActCatalogShortcuts("technician-2", storage)).toEqual({
      favoriteIds: [],
      recentIds: [],
    });
  });

  it("toggles favorites and moves an added item to the start of recent history", () => {
    expect(toggleRepairCatalogFavorite(["part-fan"], "service-clean")).toEqual([
      "service-clean",
      "part-fan",
    ]);
    expect(toggleRepairCatalogFavorite(["part-fan"], "part-fan")).toEqual([]);
    expect(recordRecentRepairCatalogItem(["part-fan", "service-clean"], "part-fan")).toEqual([
      "part-fan",
      "service-clean",
    ]);
  });
});
