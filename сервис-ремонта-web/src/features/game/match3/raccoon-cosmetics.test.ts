import { describe, expect, it } from "vitest";

import { getUnlockedRaccoonCosmetics } from "./raccoon-cosmetics";

describe("chapter cosmetic rewards", () => {
  it("unlocks each visor only after its chapter's 20 levels", () => {
    expect(getUnlockedRaccoonCosmetics(0).map(({ id }) => id)).toEqual(["default"]);
    expect(getUnlockedRaccoonCosmetics(19).map(({ id }) => id)).toEqual(["default"]);
    expect(getUnlockedRaccoonCosmetics(20).map(({ id }) => id)).toEqual(["default", "forest"]);
    expect(getUnlockedRaccoonCosmetics(60).map(({ id }) => id)).toContain("processor");
    expect(getUnlockedRaccoonCosmetics(80).map(({ id }) => id)).toContain("frost");
    expect(getUnlockedRaccoonCosmetics(100).map(({ id }) => id)).toHaveLength(6);
  });
});
