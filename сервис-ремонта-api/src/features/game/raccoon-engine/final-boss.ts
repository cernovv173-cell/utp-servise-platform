import type {
  BoardObstacle,
  GameBoard,
  PartKind,
  Position,
} from "./match-three.js";

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

const electricBlockPath: readonly Position[] = [
  { row: 0, column: 2 },
  { row: 1, column: 5 },
  { row: 3, column: 6 },
  { row: 5, column: 5 },
  { row: 6, column: 4 },
  { row: 5, column: 1 },
  { row: 3, column: 0 },
  { row: 1, column: 1 },
];

export const getElectricBlockPositions = (
  turn: number,
  count = 4,
): Position[] =>
  getElectricBlockSlots(turn)
    .slice(0, count)
    .flatMap((slot) => {
      const position = electricBlockPath[slot];
      return position ? [position] : [];
    });

export const moveElectricBlockObstacles = (
  obstacles: readonly BoardObstacle[],
  turn: number,
): BoardObstacle[] => {
  const circuitCount = obstacles.filter(
    ({ kind }) => kind === "circuit",
  ).length;
  const positions = getElectricBlockPositions(turn, circuitCount);
  let circuitIndex = 0;
  return obstacles.map((obstacle) => {
    if (obstacle.kind !== "circuit") return obstacle;
    const position = positions[circuitIndex];
    circuitIndex += 1;
    return position ? { ...obstacle, position } : obstacle;
  });
};
