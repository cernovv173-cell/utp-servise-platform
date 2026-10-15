import { describe, expect, it } from "vitest";

import { getMatch3SwipeMove } from "./match3-swipe";

describe("getMatch3SwipeMove", () => {
  it("accepts a long swipe to one orthogonally adjacent cell", () => {
    const move = getMatch3SwipeMove({ row: 3, column: 2 }, { row: 3, column: 3 }, 42, 2);

    expect(move).toEqual({
      from: { row: 3, column: 2 },
      to: { row: 3, column: 3 },
    });
  });

  it("rejects taps, diagonal swipes, and non-neighbor cells", () => {
    const from = { row: 3, column: 2 };
    expect(getMatch3SwipeMove(from, { row: 3, column: 3 }, 10, 0)).toBeNull();
    expect(getMatch3SwipeMove(from, { row: 4, column: 3 }, 40, 40)).toBeNull();
    expect(getMatch3SwipeMove(from, { row: 3, column: 4 }, 80, 0)).toBeNull();
  });
});
