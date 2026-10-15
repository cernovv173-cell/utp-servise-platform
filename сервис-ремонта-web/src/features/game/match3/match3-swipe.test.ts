import { describe, expect, it } from "vitest";

import { getMatch3SwipeMove } from "./match3-swipe";

describe("getMatch3SwipeMove", () => {
  it("maps a horizontal or vertical swipe to exactly one adjacent cell", () => {
    const from = { row: 3, column: 2 };
    const horizontal = getMatch3SwipeMove(from, 42, 2);

    expect(horizontal).toEqual({
      from,
      to: { row: 3, column: 3 },
    });
    expect(getMatch3SwipeMove(from, 2, -42)).toEqual({
      from,
      to: { row: 2, column: 2 },
    });
    expect(getMatch3SwipeMove(from, 240, 3)?.to).toEqual({ row: 3, column: 3 });
  });

  it("rejects taps and ambiguous diagonal swipes", () => {
    const from = { row: 3, column: 2 };
    expect(getMatch3SwipeMove(from, 10, 0)).toBeNull();
    expect(getMatch3SwipeMove(from, 40, 40)).toBeNull();
  });
});
