import type { ShopCraftItem, ShopProduct } from "@/lib/api";

export type ShopCatalogItem =
  { kind: "PRODUCT"; product: ShopProduct } | { kind: "CRAFT"; craft: ShopCraftItem };

const catalogCollator = new Intl.Collator("ru", { sensitivity: "base", numeric: true });

const getCatalogItemName = (item: ShopCatalogItem) =>
  item.kind === "PRODUCT" ? item.product.name : item.craft.title;

export const combineShopCatalog = (
  products: readonly ShopProduct[],
  crafts: readonly ShopCraftItem[],
): ShopCatalogItem[] =>
  [
    ...products.map((product) => ({ kind: "PRODUCT" as const, product })),
    ...crafts.map((craft) => ({ kind: "CRAFT" as const, craft })),
  ].sort((left, right) =>
    catalogCollator.compare(getCatalogItemName(left), getCatalogItemName(right)),
  );
