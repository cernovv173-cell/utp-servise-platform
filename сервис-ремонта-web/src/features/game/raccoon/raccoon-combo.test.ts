import { describe, expect, it } from "vitest";

import { didRaccoonClearCombo } from "./raccoon-combo";

describe("didRaccoonClearCombo", () => {
  it("reacts when a move clears four or more component tiles", () => {
    expect(didRaccoonClearCombo({ cpu: 2 }, { cpu: 5, ssd: 1 })).toBe(true);
  });

  it("ignores ordinary three-piece clears and obstacle counts", () => {
    expect(didRaccoonClearCombo({ cpu: 1, crate: 1 }, { cpu: 4, crate: 4 })).toBe(false);
  });
});
