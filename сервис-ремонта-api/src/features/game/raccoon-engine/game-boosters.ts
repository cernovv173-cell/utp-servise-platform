import { BOARD_COLUMNS, type GameBoard, type Position } from "./match-three.js";

export type BoosterKind = "hammer" | "rocket" | "bomb";
export type BoosterCounts = Record<BoosterKind, number>;

export const createInitialBoosters = (): BoosterCounts => ({
  hammer: 3,
  rocket: 3,
  bomb: 3,
});

export const getBoosterTargets = (
  booster: BoosterKind,
  center: Position,
  board: GameBoard,
): Position[] => {
  const rows = board.length;
  const columns = board[0]?.length ?? BOARD_COLUMNS;
  if (booster === "hammer") return [center];
  if (booster === "rocket") {
    return [
      ...Array.from({ length: columns }, (_, column) => ({
        row: center.row,
        column,
      })),
      ...Array.from({ length: rows }, (_, row) => ({
        row,
        column: center.column,
      })),
    ].filter((position) => board[position.row]?.[position.column] != null);
  }
  return Array.from({ length: rows }, (_, row) => row)
    .flatMap((row) =>
      Array.from({ length: columns }, (_, column) => ({ row, column })),
    )
    .filter(
      (position) =>
        board[position.row]?.[position.column] != null &&
        Math.abs(position.row - center.row) <= 1 &&
        Math.abs(position.column - center.column) <= 1,
    );
};
