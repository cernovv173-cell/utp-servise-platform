import { describe, expect, it } from "vitest";

import { clearRetiredGameStorage } from "./retired-game-cache";

describe("clearRetiredGameStorage", () => {
  it("removes all former game preferences without touching customer or site data", () => {
    const values = new Map([
      ["match3:daily-challenge-completion:v1:customer-1", "2026-10-24"],
      ["match3:raccoon-cosmetic:v1:customer-1", "forest"],
      ["match3:raccoon-voice-enabled:v1", "true"],
      ["utp-shop-cart:customer-1", '{"item":1}'],
      ["utp-web-theme", "dark"],
    ]);
    const storage: Storage = {
      get length() {
        return values.size;
      },
      key: (index) => Array.from(values.keys())[index] ?? null,
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => void values.set(key, value),
      removeItem: (key) => void values.delete(key),
      clear: () => values.clear(),
    };

    clearRetiredGameStorage(storage);

    expect(Array.from(values.keys())).toEqual(["utp-shop-cart:customer-1", "utp-web-theme"]);
  });
});
