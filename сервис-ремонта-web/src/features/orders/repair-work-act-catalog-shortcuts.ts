import type { RepairCatalogItem } from "@/lib/api";

export type RepairWorkActCatalogShortcuts = {
  favoriteIds: string[];
  recentIds: string[];
};

export type RepairWorkActCatalogMode = "ALL" | "FAVORITES" | "RECENT";
export type RepairWorkActCatalogTypeFilter = "ALL" | RepairCatalogItem["type"];

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const storagePrefix = "repair-work-act-catalog-shortcuts:v1:";
const maxRecentItems = 8;

export const emptyRepairWorkActCatalogShortcuts = (): RepairWorkActCatalogShortcuts => ({
  favoriteIds: [],
  recentIds: [],
});

export const toggleRepairCatalogFavorite = (favoriteIds: readonly string[], itemId: string) =>
  favoriteIds.includes(itemId)
    ? favoriteIds.filter((id) => id !== itemId)
    : [itemId, ...favoriteIds];

export const recordRecentRepairCatalogItem = (recentIds: readonly string[], itemId: string) =>
  [itemId, ...recentIds.filter((id) => id !== itemId)].slice(0, maxRecentItems);

export const filterRepairWorkActCatalogItems = (
  items: readonly RepairCatalogItem[],
  options: {
    mode: RepairWorkActCatalogMode;
    typeFilter: RepairWorkActCatalogTypeFilter;
    query: string;
    favoriteIds: readonly string[];
    recentIds: readonly string[];
  },
) => {
  const query = options.query.trim().toLocaleLowerCase("ru-RU");
  const shortcutIds = options.mode === "FAVORITES" ? options.favoriteIds : options.recentIds;
  const shortcutOrder = new Map(shortcutIds.map((id, index) => [id, index]));

  const matchingItems = items.filter((item) => {
    const matchesMode = options.mode === "ALL" || shortcutOrder.has(item.id);
    const matchesType = options.typeFilter === "ALL" || item.type === options.typeFilter;
    const matchesQuery =
      query.length === 0 ||
      `${item.name} ${item.description ?? ""}`.toLocaleLowerCase("ru-RU").includes(query);
    return matchesMode && matchesType && matchesQuery;
  });

  if (options.mode !== "ALL") {
    return matchingItems.sort(
      (left, right) =>
        (shortcutOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
        (shortcutOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }

  const favoriteOrder = new Map(options.favoriteIds.map((id, index) => [id, index]));
  return matchingItems.sort((left, right) => {
    const leftOrder = favoriteOrder.get(left.id);
    const rightOrder = favoriteOrder.get(right.id);
    if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder;
    if (leftOrder !== undefined) return -1;
    if (rightOrder !== undefined) return 1;
    return left.name.localeCompare(right.name, "ru-RU");
  });
};

const browserStorage = (): StorageLike | null => {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
};

export const readRepairWorkActCatalogShortcuts = (
  userId: string,
  storage: StorageLike | null = browserStorage(),
): RepairWorkActCatalogShortcuts => {
  if (!storage || !userId) return emptyRepairWorkActCatalogShortcuts();

  try {
    const value = storage.getItem(`${storagePrefix}${encodeURIComponent(userId)}`);
    if (!value) return emptyRepairWorkActCatalogShortcuts();
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) {
      return emptyRepairWorkActCatalogShortcuts();
    }
    const data = parsed as Record<string, unknown>;
    const cleanIds = (candidate: unknown) =>
      Array.isArray(candidate)
        ? [
            ...new Set(
              candidate.filter((id): id is string => typeof id === "string" && id.length > 0),
            ),
          ]
        : [];
    return {
      favoriteIds: cleanIds(data.favoriteIds),
      recentIds: cleanIds(data.recentIds).slice(0, maxRecentItems),
    };
  } catch {
    return emptyRepairWorkActCatalogShortcuts();
  }
};

export const saveRepairWorkActCatalogShortcuts = (
  userId: string,
  shortcuts: RepairWorkActCatalogShortcuts,
  storage: StorageLike | null = browserStorage(),
) => {
  if (!storage || !userId) return;
  try {
    storage.setItem(
      `${storagePrefix}${encodeURIComponent(userId)}`,
      JSON.stringify({
        favoriteIds: [...new Set(shortcuts.favoriteIds)],
        recentIds: [...new Set(shortcuts.recentIds)].slice(0, maxRecentItems),
      }),
    );
  } catch {
    // A private browsing or storage-quota restriction should not block adding catalog items.
  }
};
