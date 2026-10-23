import type { RaccoonBoard, RaccoonPart, RaccoonPosition } from "./raccoon-game-api";

export const RACCOON_CELL_SIZE = 0.9;
export const RACCOON_CELL_GAP = 0.08;
export const RACCOON_CELL_STEP = RACCOON_CELL_SIZE + RACCOON_CELL_GAP;

export type RaccoonBoardCell3D = {
  position: RaccoonPosition;
  part: RaccoonPart;
  world: [number, number, number];
};

export type RaccoonGestureResult =
  | { kind: "tap"; position: RaccoonPosition }
  | { kind: "swipe"; from: RaccoonPosition; to: RaccoonPosition };

export const getRaccoonCellWorldPosition = (
  position: RaccoonPosition,
  rows: number,
  columns: number,
  height = 0,
): [number, number, number] => [
  (position.column - (columns - 1) / 2) * RACCOON_CELL_STEP,
  height,
  (position.row - (rows - 1) / 2) * RACCOON_CELL_STEP,
];

export const getRaccoonBoardCells3D = (board: RaccoonBoard): RaccoonBoardCell3D[] => {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;

  return board.flatMap((row, rowIndex) =>
    row.flatMap((part, columnIndex) => {
      if (!part) return [];
      const position = { row: rowIndex, column: columnIndex };
      return [
        {
          position,
          part,
          world: getRaccoonCellWorldPosition(position, rows, columns),
        },
      ];
    }),
  );
};

export const getRaccoonGestureResult = (
  start: RaccoonPosition,
  deltaX: number,
  deltaY: number,
  rows: number,
  columns: number,
  threshold = 20,
): RaccoonGestureResult => {
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < threshold) {
    return { kind: "tap", position: start };
  }

  const to =
    Math.abs(deltaX) > Math.abs(deltaY)
      ? { row: start.row, column: start.column + Math.sign(deltaX) }
      : { row: start.row + Math.sign(deltaY), column: start.column };

  return to.row >= 0 && to.row < rows && to.column >= 0 && to.column < columns
    ? { kind: "swipe", from: start, to }
    : { kind: "tap", position: start };
};

export const raccoonPartColors: Record<RaccoonPart, string> = {
  cpu: "#2dd4bf",
  gpu: "#a78bfa",
  ram: "#4ade80",
  ssd: "#38bdf8",
  board: "#bef264",
  fan: "#e2e8f0",
  gold: "#fbbf24",
};

export const raccoonChapterLighting = (chapter: number) => {
  switch (chapter) {
    case 2:
      return { wall: "#473126", floor: "#33231b", glow: "#fda65a", accent: "#d38b55" };
    case 3:
      return { wall: "#1b3038", floor: "#14232a", glow: "#5de4f5", accent: "#29889a" };
    case 4:
      return { wall: "#20342e", floor: "#172722", glow: "#91e9b2", accent: "#56a67d" };
    case 5:
      return { wall: "#201c39", floor: "#17132a", glow: "#6fe8ff", accent: "#7c61c8" };
    default:
      return { wall: "#4b3023", floor: "#332018", glow: "#ffbd6a", accent: "#b66f38" };
  }
};
