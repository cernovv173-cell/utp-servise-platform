export const MATCH3_BOARD_SIZE = 7;
const TILE_COUNT = 8;
const MAX_CASCADES = 100;

export type Match3Board = number[][];
export type Match3Position = { readonly row: number; readonly column: number };

export type Match3MoveResult = {
  readonly accepted: boolean;
  readonly board: Match3Board;
  readonly targetCollected: number;
  readonly removedCount: number;
  readonly cascades: number;
};

const isPosition = ({ row, column }: Match3Position) =>
  Number.isInteger(row) &&
  Number.isInteger(column) &&
  row >= 0 &&
  row < MATCH3_BOARD_SIZE &&
  column >= 0 &&
  column < MATCH3_BOARD_SIZE;

export const isMatch3Board = (value: unknown): value is Match3Board =>
  Array.isArray(value) &&
  value.length === MATCH3_BOARD_SIZE &&
  value.every(
    (row) =>
      Array.isArray(row) &&
      row.length === MATCH3_BOARD_SIZE &&
      row.every(
        (tile) => Number.isInteger(tile) && tile >= 0 && tile < TILE_COUNT,
      ),
  );

const randomTile = (targetTile: number, random: () => number): number => {
  if (random() < 0.4) return targetTile;
  const otherTile = Math.floor(random() * (TILE_COUNT - 1));
  return otherTile >= targetTile ? otherTile + 1 : otherTile;
};

const hasImmediateMatch = (
  board: Match3Board,
  row: number,
  column: number,
  tile: number,
): boolean =>
  (column >= 2 && board[row]![column - 1] === tile && board[row]![column - 2] === tile) ||
  (row >= 2 && board[row - 1]![column] === tile && board[row - 2]![column] === tile);

export const findMatchIndexes = (board: Match3Board): Set<number> => {
  const matches = new Set<number>();

  for (let row = 0; row < MATCH3_BOARD_SIZE; row += 1) {
    let start = 0;
    for (let column = 1; column <= MATCH3_BOARD_SIZE; column += 1) {
      const sameTile =
        column < MATCH3_BOARD_SIZE &&
        board[row]![column] === board[row]![start];
      if (sameTile) continue;
      if (column - start >= 3) {
        for (let index = start; index < column; index += 1)
          matches.add(row * MATCH3_BOARD_SIZE + index);
      }
      start = column;
    }
  }

  for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
    let start = 0;
    for (let row = 1; row <= MATCH3_BOARD_SIZE; row += 1) {
      const sameTile =
        row < MATCH3_BOARD_SIZE &&
        board[row]![column] === board[start]![column];
      if (sameTile) continue;
      if (row - start >= 3) {
        for (let index = start; index < row; index += 1)
          matches.add(index * MATCH3_BOARD_SIZE + column);
      }
      start = row;
    }
  }

  return matches;
};

const swap = (board: Match3Board, from: Match3Position, to: Match3Position) => {
  const next = board.map((row) => [...row]);
  const first = next[from.row]![from.column]!;
  next[from.row]![from.column] = next[to.row]![to.column]!;
  next[to.row]![to.column] = first;
  return next;
};

export const hasAvailableMatch3Move = (board: Match3Board): boolean => {
  for (let row = 0; row < MATCH3_BOARD_SIZE; row += 1) {
    for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
      const from = { row, column };
      for (const to of [
        { row, column: column + 1 },
        { row: row + 1, column },
      ]) {
        if (!isPosition(to)) continue;
        if (findMatchIndexes(swap(board, from, to)).size > 0) return true;
      }
    }
  }
  return false;
};

export const createMatch3Board = (
  targetTile: number,
  random: () => number = Math.random,
): Match3Board => {
  if (!Number.isInteger(targetTile) || targetTile < 0 || targetTile >= TILE_COUNT)
    throw new RangeError("Unknown match-3 component.");

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const board = Array.from({ length: MATCH3_BOARD_SIZE }, () =>
      Array<number>(MATCH3_BOARD_SIZE).fill(-1),
    );

    for (let row = 0; row < MATCH3_BOARD_SIZE; row += 1) {
      for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
        const preferred = randomTile(targetTile, random);
        const candidates = Array.from({ length: TILE_COUNT }, (_, index) => index).filter(
          (tile) => tile !== preferred,
        );
        for (let index = candidates.length - 1; index > 0; index -= 1) {
          const other = Math.floor(random() * (index + 1));
          [candidates[index], candidates[other]] = [candidates[other]!, candidates[index]!];
        }
        const tile = [preferred, ...candidates].find(
          (candidate) => !hasImmediateMatch(board, row, column, candidate),
        );
        board[row]![column] = tile ?? preferred;
      }
    }

    if (hasAvailableMatch3Move(board)) return board;
  }
  throw new Error("Could not create a playable match-3 board.");
};

const refillBoard = (
  board: Match3Board,
  random: () => number,
  targetTile: number,
) => {
  for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
    const remaining = board
      .map((row) => row[column]!)
      .filter((tile) => tile >= 0);
    const missing = MATCH3_BOARD_SIZE - remaining.length;
    const filled = [
      ...Array.from({ length: missing }, () => randomTile(targetTile, random)),
      ...remaining,
    ];
    for (let row = 0; row < MATCH3_BOARD_SIZE; row += 1)
      board[row]![column] = filled[row]!;
  }
};

export const applyMatch3Move = (
  board: Match3Board,
  from: Match3Position,
  to: Match3Position,
  targetTile: number,
  random: () => number = Math.random,
): Match3MoveResult => {
  if (
    !isMatch3Board(board) ||
    !isPosition(from) ||
    !isPosition(to) ||
    Math.abs(from.row - to.row) + Math.abs(from.column - to.column) !== 1
  ) {
    return { accepted: false, board, targetCollected: 0, removedCount: 0, cascades: 0 };
  }

  let next = swap(board, from, to);
  let matches = findMatchIndexes(next);
  if (matches.size === 0)
    return { accepted: false, board, targetCollected: 0, removedCount: 0, cascades: 0 };

  let targetCollected = 0;
  let removedCount = 0;
  let cascades = 0;

  while (matches.size > 0 && cascades < MAX_CASCADES) {
    for (const index of matches) {
      const row = Math.floor(index / MATCH3_BOARD_SIZE);
      const column = index % MATCH3_BOARD_SIZE;
      if (next[row]![column] === targetTile) targetCollected += 1;
      next[row]![column] = -1;
    }
    removedCount += matches.size;
    cascades += 1;
    refillBoard(next, random, targetTile);
    matches = findMatchIndexes(next);
  }

  if (matches.size > 0 || !hasAvailableMatch3Move(next))
    next = createMatch3Board(targetTile, random);

  return { accepted: true, board: next, targetCollected, removedCount, cascades };
};
