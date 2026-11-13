import type { CraftItem } from "@/lib/api";

export const craftItemImageIds = (item: Pick<CraftItem, "imageObjectId" | "imageObjectIds">) =>
  Array.from(
    new Set(
      item.imageObjectIds?.length
        ? item.imageObjectIds
        : item.imageObjectId
          ? [item.imageObjectId]
          : [],
    ),
  ).slice(0, 3);
