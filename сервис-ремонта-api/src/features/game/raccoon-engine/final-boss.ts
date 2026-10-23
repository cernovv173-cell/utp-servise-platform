import type { GameBoard, PartKind, Position } from "./match-three.js";

export const MAGNET_CHARGE_SIZE = 20;

const centerCell = ({ row, column }: Position): boolean =>
  row >= 1 && row <= 5 && column >= 1 && column <= 5;

export const magnetizeGoldToCenter = (board: GameBoard): GameBoard => {
  const next = board.map((row) => [...row]);
  const goldOutside = next.flatMap((row, rowIndex) =>
    row.flatMap((part, columnIndex) =>
      part === "gold" && !centerCell({ row: rowIndex, column: columnIndex })
        ? [{ row: rowIndex, column: columnIndex }]
        : [],
    ),
  );

  for (const origin of goldOutside) {
    const target = next.flatMap((row, rowIndex) =>
      row.flatMap((part, columnIndex) =>
        part !== null &&
        part !== "gold" &&
        centerCell({ row: rowIndex, column: columnIndex })
          ? [{ row: rowIndex, column: columnIndex }]
          : [],
      ),
    )[0];
    if (!target) break;
    const originRow = next[origin.row];
    const targetRow = next[target.row];
    if (!originRow || !targetRow) continue;
    const originPart = originRow[origin.column];
    const targetPart = targetRow[target.column];
    if (originPart === undefined || targetPart === undefined) continue;
    originRow[origin.column] = targetPart;
    targetRow[target.column] = originPart;
  }

  return next;
};

export const countParts = (board: GameBoard, part: PartKind): number =>
  board.flat().filter((cell) => cell === part).length;

export const getElectricBlockSlots = (turn: number): number[] =>
  Array.from({ length: 4 }, (_, index) => (turn + index * 2) % 8);
