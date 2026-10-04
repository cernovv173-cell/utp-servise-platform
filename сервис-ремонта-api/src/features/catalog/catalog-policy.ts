export const isInventoryCatalogItem = (type: string): boolean =>
  type === "SPARE_PART" || type === "PRODUCT";
