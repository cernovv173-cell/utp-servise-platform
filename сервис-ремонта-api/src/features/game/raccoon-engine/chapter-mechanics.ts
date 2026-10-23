import {
  BOARD_COLUMNS,
  type BoardObstacle,
  type BoardRules,
  FINAL_BOSS_BOARD_RULES,
  FINAL_BOSS_LEVEL,
  type GameBoard,
  findMatches,
} from "./match-three.js";

const crateSpots = [
  { row: 2, column: 1 },
  { row: 2, column: 4 },
  { row: 4, column: 1 },
  { row: 4, column: 4 },
  { row: 3, column: 2 },
  { row: 3, column: 5 },
] as const;

const circuitSpots = [
  { row: 0, column: 2 },
  { row: 0, column: 3 },
  { row: 1, column: 1 },
  { row: 1, column: 4 },
  { row: 5, column: 1 },
  { row: 5, column: 4 },
  { row: 6, column: 2 },
  { row: 6, column: 3 },
] as const;

export type ChapterMechanics = {
  readonly obstacles: readonly BoardObstacle[];
  readonly conveyorRow: number | null;
  readonly conveyorTurn: number;
};

export const createChapterMechanics = (level: number): ChapterMechanics => {
  const crateCount =
    level >= 21 && level <= 40
      ? 2 + Math.floor((level - 21) / 5)
      : level >= 81 && level < FINAL_BOSS_LEVEL
        ? 2 + Math.floor((level - 81) / 10)
        : level === FINAL_BOSS_LEVEL
          ? 2
          : 0;
  const circuitCount =
    level >= 41 && level <= 60
      ? 2 + Math.floor((level - 41) / 5)
      : level >= 81 && level < FINAL_BOSS_LEVEL
        ? 2 + Math.floor((level - 81) / 10)
        : level === FINAL_BOSS_LEVEL
          ? 2
          : 0;
  const finalBoss = level === FINAL_BOSS_LEVEL;
  const columns = finalBoss
    ? (FINAL_BOSS_BOARD_RULES.shape?.[0]?.length ?? 7)
    : BOARD_COLUMNS;
  const isPlayable = (row: number, column: number) =>
    column < columns &&
    (!finalBoss || Boolean(FINAL_BOSS_BOARD_RULES.shape?.[row]?.[column]));
  const crates: BoardObstacle[] = crateSpots
    .filter(({ row, column }) => isPlayable(row, column))
    .slice(0, crateCount)
    .map((position) => ({ kind: "crate", position }));
  const circuits: BoardObstacle[] = circuitSpots
    .filter(({ row, column }) => isPlayable(row, column))
    .slice(0, circuitCount)
    .map((position) => ({ kind: "circuit", position }));
  const conveyorRow =
    level >= 61 && level <= 80
      ? 2 + (level % 3)
      : level >= 81 && level < FINAL_BOSS_LEVEL
        ? 2 + (level % 3)
        : level === FINAL_BOSS_LEVEL
          ? 3
          : null;

  return { obstacles: [...crates, ...circuits], conveyorRow, conveyorTurn: 0 };
};

export const moveConveyor = (
  board: GameBoard,
  row: number | null,
  turn: number,
  rules: BoardRules,
): GameBoard => {
  if (row === null || row < 0 || row >= board.length) return board;
  const sourceRow = board[row];
  if (!sourceRow) return board;
  const blocked = new Set(
    rules.obstacles?.map(
      ({ position }) => `${position.row}:${position.column}`,
    ),
  );
  const next = board.map((boardRow) => [...boardRow]);
  const nextRow = next[row];
  if (!nextRow) return board;
  let segment: number[] = [];
  let moved = false;

  const shiftSegment = () => {
    if (segment.length < 2) return;
    const parts = segment.map((column) => nextRow[column] ?? null);
    const direction = turn % 2 === 0 ? 1 : -1;
    const shifted =
      direction > 0
        ? [parts[parts.length - 1], ...parts.slice(0, -1)]
        : [...parts.slice(1), parts[0]];
    segment.forEach((column, index) => {
      nextRow[column] = shifted[index] ?? null;
    });
    moved = true;
  };

  for (let column = 0; column <= (board[row]?.length ?? 0); column += 1) {
    if (
      column < (board[row]?.length ?? 0) &&
      sourceRow[column] != null &&
      !blocked.has(`${row}:${column}`)
    ) {
      segment.push(column);
      continue;
    }
    shiftSegment();
    segment = [];
  }

  if (!moved || findMatches(next, rules).length > 0) return board;
  return next;
};
