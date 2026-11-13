import { describe, expect, it } from "vitest";

import type { ShopCraftItem, ShopProduct } from "@/lib/api";

import { combineShopCatalog } from "./shop-catalog";

const product = (id: string, name: string): ShopProduct => ({
  id,
  name,
  description: null,
  imageObjectIds: [],
  unitPriceRub: 100,
  availability: "IN_STOCK",
});

const craft = (id: string, title: string): ShopCraftItem => ({
  id,
  title,
  description: "",
  priceRub: 100,
  imageObjectId: null,
  imageObjectIds: [],
  stockQuantity: 1,
  customOrderAvailable: false,
});

describe("unified shop catalog", () => {
  it("mixes products and ready handmade items in one alphabetized list", () => {
    const catalog = combineShopCatalog(
      [product("product-2", "Чехол"), product("product-1", "Зарядное устройство")],
      [craft("craft-1", "Брелок ручной работы")],
    );

    expect(
      catalog.map((item) => (item.kind === "PRODUCT" ? item.product.name : item.craft.title)),
    ).toEqual(["Брелок ручной работы", "Зарядное устройство", "Чехол"]);
    expect(catalog.map((item) => item.kind)).toEqual(["CRAFT", "PRODUCT", "PRODUCT"]);
  });

  it("returns an empty catalog only when both sources are empty", () => {
    expect(combineShopCatalog([], [])).toEqual([]);
    expect(combineShopCatalog([product("product-1", "Мышь")], [])).toHaveLength(1);
    expect(combineShopCatalog([], [craft("craft-1", "Сувенир")])).toHaveLength(1);
  });
});
