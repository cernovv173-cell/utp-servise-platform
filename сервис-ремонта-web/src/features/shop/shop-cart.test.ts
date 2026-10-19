import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getShopCartCount, loadShopCart, setShopCartQuantity } from "./shop-cart";

describe("shop cart", () => {
  const storage = new Map<string, string>();

  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      clear: () => storage.clear(),
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it("loads only valid product quantities", () => {
    localStorage.setItem("cart", JSON.stringify({ first: 2, second: 0, third: "3", fourth: -1 }));
    expect(loadShopCart("cart")).toEqual({ first: 2 });
  });

  it("adds, caps and removes quantities without mutating the previous cart", () => {
    const original = { first: 1 };
    const increased = setShopCartQuantity(original, "first", 101);
    expect(increased).toEqual({ first: 100 });
    expect(original).toEqual({ first: 1 });
    expect(setShopCartQuantity(increased, "first", 0)).toEqual({});
  });

  it("counts all items across product lines", () => {
    expect(getShopCartCount({ first: 2, second: 3 })).toBe(5);
  });
});
