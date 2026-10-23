import { describe, expect, it } from "vitest";

import {
  RACCOON_CELL_STEP,
  getRaccoonBoardCells3D,
  getRaccoonCellWorldPosition,
  getRaccoonGestureResult,
  raccoonChapterLighting,
} from "./raccoon-3d-geometry";
import type { RaccoonBoard } from "./raccoon-game-api";

describe("raccoon 3D board geometry", () => {
  it("centers grid cells around the scene origin", () => {
    expect(getRaccoonCellWorldPosition({ row: 0, column: 0 }, 3, 3)).toEqual([
      -RACCOON_CELL_STEP,
      0,
      -RACCOON_CELL_STEP,
    ]);
    expect(getRaccoonCellWorldPosition({ row: 1, column: 1 }, 3, 3, 0.5)).toEqual([0, 0.5, 0]);
  });

  it("keeps the final gear outline by omitting empty cells", () => {
    const board: RaccoonBoard = [
      [null, "cpu", "gold", null],
      ["ram", "fan", "ssd", "board"],
      [null, "gpu", "cpu", null],
    ];

    const cells = getRaccoonBoardCells3D(board);

    expect(cells).toHaveLength(8);
    expect(cells[0]).toMatchObject({
      position: { row: 0, column: 1 },
      part: "cpu",
      world: [-RACCOON_CELL_STEP / 2, 0, -RACCOON_CELL_STEP],
    });
    expect(cells.at(-1)?.position).toEqual({ row: 2, column: 2 });
  });

  it("uses a distinct lighting palette for each workshop chapter", () => {
    expect(raccoonChapterLighting(1).glow).toBe("#ffbd6a");
    expect(raccoonChapterLighting(3).glow).toBe("#5de4f5");
    expect(raccoonChapterLighting(5).glow).toBe("#6fe8ff");
  });

  it("turns a short touch into a selection and a drag into one adjacent move", () => {
    const start = { row: 2, column: 2 };
    expect(getRaccoonGestureResult(start, 8, 5, 5, 5)).toEqual({ kind: "tap", position: start });
    expect(getRaccoonGestureResult(start, 45, 12, 5, 5)).toEqual({
      kind: "swipe",
      from: start,
      to: { row: 2, column: 3 },
    });
    expect(getRaccoonGestureResult(start, -4, -55, 5, 5)).toEqual({
      kind: "swipe",
      from: start,
      to: { row: 1, column: 2 },
    });
  });

  it("keeps a gesture on the board edges instead of sending an invalid move", () => {
    expect(getRaccoonGestureResult({ row: 0, column: 0 }, -70, 2, 5, 5)).toEqual({
      kind: "tap",
      position: { row: 0, column: 0 },
    });
  });
});
