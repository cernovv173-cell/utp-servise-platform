const RETIRED_GAME_CACHE_MARKER = "utp-retired-game-cache-cleared:v1";
const RETIRED_GAME_CACHE_URL = "/retired-game-cache.json";

type BrowserStorage = Pick<Storage, "length" | "key" | "removeItem">;

export const clearRetiredGameStorage = (storage: BrowserStorage): void => {
  const retiredKeys: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith("match3:")) retiredKeys.push(key);
    }
  } catch {
    return;
  }

  for (const key of retiredKeys) {
    try {
      storage.removeItem(key);
    } catch {
      // Keep cleanup best-effort when a browser blocks storage access.
    }
  }
};

export const clearRetiredGameCache = (): void => {
  if (typeof window === "undefined") return;

  let storage: Storage | null = null;
  try {
    storage = window.localStorage;
    clearRetiredGameStorage(storage);
  } catch {
    // Continue with the browser-wide cache purge when local storage is unavailable.
  }

  let alreadyCleared = false;
  try {
    alreadyCleared = storage?.getItem(RETIRED_GAME_CACHE_MARKER) === "done";
  } catch {
    // Without a marker, retry the cache purge on the next visit.
  }
  if (alreadyCleared) return;

  if ("caches" in window) {
    void window.caches
      .keys()
      .then((cacheNames) =>
        Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName))),
      )
      .catch(() => undefined);
  }

  void fetch(RETIRED_GAME_CACHE_URL, { cache: "no-store", credentials: "same-origin" })
    .then((response) => {
      if (response.ok) storage?.setItem(RETIRED_GAME_CACHE_MARKER, "done");
    })
    .catch(() => undefined);
};
