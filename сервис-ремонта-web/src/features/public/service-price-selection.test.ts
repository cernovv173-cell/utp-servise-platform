import { describe, expect, it } from "vitest";

import {
  featuredHomeServiceNames,
  pickHomeServicePrices,
} from "@/features/public/service-price-selection";

import type { CustomerServicePrice } from "@/lib/api";

const price = (name: string, unitPriceRub: number): CustomerServicePrice => ({
  id: name,
  name,
  unitPriceRub,
});

describe("home service price selection", () => {
  it("keeps the popular works in the configured order", () => {
    const prices = featuredHomeServiceNames
      .map((name, index) => price(name, 500 + index * 100))
      .reverse();

    expect(pickHomeServicePrices(prices).map((entry) => entry.name)).toEqual([
      ...featuredHomeServiceNames,
    ]);
  });

  it("skips names that are missing from the active price list", () => {
    const prices = [
      price("Диагностика ПК", 880),
      price("Замена блока питания", 450),
      price("Установка Windows 11", 2700),
      price("Установка Windows Server", 4500),
    ];

    expect(pickHomeServicePrices(prices).map((entry) => entry.name)).toEqual([
      "Диагностика ПК",
      "Замена блока питания",
      "Установка Windows 11",
    ]);
  });

  it("falls back to the actual price list when popular works are unavailable", () => {
    const prices = [price("Пайка деталей", 1500), price("Разборка ноутбука", 1700)];

    expect(pickHomeServicePrices(prices).map((entry) => entry.name)).toEqual([
      "Пайка деталей",
      "Разборка ноутбука",
    ]);
  });

  it("respects the ticker limit and empty responses", () => {
    const prices = [
      price("Пайка деталей", 1500),
      price("Разборка ноутбука", 1700),
      price("Клонирование диска", 1500),
      price("Установка драйверов", 350),
    ];

    expect(pickHomeServicePrices(prices, 3).map((entry) => entry.name)).toEqual([
      "Пайка деталей",
      "Разборка ноутбука",
      "Клонирование диска",
    ]);
    expect(pickHomeServicePrices([], 10)).toEqual([]);
  });
});
