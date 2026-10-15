import type { Match3BoosterKey } from "./match3-boosters.js";
import {
  MATCH3_PARTS,
  type Match3PartKey,
  getMatch3ObstaclePlan,
} from "./match3-content.js";

export const MATCH3_BOARD_SIZE = 8;

export type Match3Tile = {
  kind: Match3PartKey | null;
  frozen: boolean;
  junk: boolean;
  anomalyTurns: number | null;
};

export type Match3Board = Match3Tile[][];

export type Match3Position = { row: number; column: number };
export type Match3Hint = { from: Match3Position; to: Match3Position };

export type Match3MoveResult = {
  accepted: boolean;
  board: Match3Board;
  targetMatched: number;
  partsMatched: Record<Match3PartKey, number>;
  obstaclesCleared: number;
  obstaclesUnlocked: number;
};

const partKeys = new Set<string>(MATCH3_PARTS.map((part) => part.key));

const emptyTile = (): Match3Tile => ({
  kind: null,
  frozen: false,
  junk: false,
  anomalyTurns: null,
});

const randomPart = (): Match3PartKey =>
  MATCH3_PARTS[Math.floor(Math.random() * MATCH3_PARTS.length)]!.key;

const emptyPartCounts = (): Record<Match3PartKey, number> =>
  Object.fromEntries(MATCH3_PARTS.map(({ key }) => [key, 0])) as Record<
    Match3PartKey,
    number
  >;

const rejectedMove = (board: Match3Board): Match3MoveResult => ({
  accepted: false,
  board,
  targetMatched: 0,
  partsMatched: emptyPartCounts(),
  obstaclesCleared: 0,
  obstaclesUnlocked: 0,
});

const canMatch = (
  tile: Match3Tile | undefined,
): tile is Match3Tile & {
  kind: Match3PartKey;
} => Boolean(tile?.kind && !tile.junk && !tile.frozen);

const shuffle = <T>(items: T[]): T[] => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other]!, result[index]!];
  }
  return result;
};

export const createMatch3Board = (levelNumber: number): Match3Board => {
  const board: Match3Board = [];
  for (let row = 0; row < MATCH3_BOARD_SIZE; row += 1) {
    const line: Match3Tile[] = [];
    for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
      const forbidden = new Set<Match3PartKey>();
      if (column >= 2 && line[column - 1]?.kind === line[column - 2]?.kind) {
        forbidden.add(line[column - 1]!.kind!);
      }
      if (
        row >= 2 &&
        board[row - 1]?.[column]?.kind === board[row - 2]?.[column]?.kind
      ) {
        forbidden.add(board[row - 1]![column]!.kind!);
      }
      const options = MATCH3_PARTS.filter((part) => !forbidden.has(part.key));
      line.push({
        kind: options[Math.floor(Math.random() * options.length)]!.key,
        frozen: false,
        junk: false,
        anomalyTurns: null,
      });
    }
    board.push(line);
  }

  const plan = getMatch3ObstaclePlan(levelNumber);
  const positions = shuffle(
    board.flatMap((line, row) =>
      line.map((_tile, column) => ({ row, column })),
    ),
  );
  const place = (
    count: number,
    predicate: (tile: Match3Tile) => boolean,
    update: (tile: Match3Tile) => Match3Tile,
  ) => {
    let placed = 0;
    for (const { row, column } of positions) {
      const tile = board[row]![column]!;
      if (placed >= count) break;
      if (!predicate(tile)) continue;
      board[row]![column] = update(tile);
      placed += 1;
    }
  };

  place(
    plan.frozen,
    (tile) => !tile.frozen,
    (tile) => ({ ...tile, frozen: true }),
  );
  place(
    plan.junk,
    (tile) => !tile.frozen && !tile.junk,
    () => ({ ...emptyTile(), junk: true }),
  );
  place(
    plan.anomalies,
    (tile) => !tile.frozen && !tile.junk,
    (tile) => ({ ...tile, anomalyTurns: 3 }),
  );
  return board;
};

const findMatches = (board: Match3Board): Set<string> => {
  const matched = new Set<string>();
  const scan = (positions: Match3Position[]) => {
    let run: Match3Position[] = [];
    let runKind: Match3PartKey | null = null;
    const flush = () => {
      if (run.length >= 3) {
        run.forEach(({ row, column }) => matched.add(`${row}:${column}`));
      }
      run = [];
      runKind = null;
    };
    for (const position of positions) {
      const tile = board[position.row]?.[position.column];
      if (canMatch(tile) && (runKind === null || tile.kind === runKind)) {
        run.push(position);
        runKind = tile.kind;
      } else {
        flush();
        if (canMatch(tile)) {
          run.push(position);
          runKind = tile.kind;
        }
      }
    }
    flush();
  };

  for (let row = 0; row < MATCH3_BOARD_SIZE; row += 1) {
    scan(
      Array.from({ length: MATCH3_BOARD_SIZE }, (_, column) => ({
        row,
        column,
      })),
    );
  }
  for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
    scan(
      Array.from({ length: MATCH3_BOARD_SIZE }, (_, row) => ({ row, column })),
    );
  }
  return matched;
};

const neighborsOf = (row: number, column: number): Match3Position[] =>
  [
    { row: row - 1, column },
    { row: row + 1, column },
    { row, column: column - 1 },
    { row, column: column + 1 },
  ].filter(
    ({ row: neighborRow, column: neighborColumn }) =>
      neighborRow >= 0 &&
      neighborRow < MATCH3_BOARD_SIZE &&
      neighborColumn >= 0 &&
      neighborColumn < MATCH3_BOARD_SIZE,
  );

const collapseBoard = (board: Match3Board) => {
  for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
    let segment: number[] = [];
    const collapseSegment = () => {
      const tiles = segment
        .map((row) => board[row]![column]!)
        .filter((tile) => tile.kind !== null && !tile.junk);
      segment.forEach((row, index) => {
        board[row]![column] = tiles[index] ?? {
          kind: randomPart(),
          frozen: false,
          junk: false,
          anomalyTurns: null,
        };
      });
      segment = [];
    };
    for (let row = MATCH3_BOARD_SIZE - 1; row >= 0; row -= 1) {
      const tile = board[row]![column]!;
      if (tile.frozen || tile.junk) collapseSegment();
      else segment.push(row);
    }
    collapseSegment();
  }
};

const resolveMatches = (
  board: Match3Board,
  targetPart: Match3PartKey,
): Omit<Match3MoveResult, "accepted"> => {
  let targetMatched = 0;
  const partsMatched = emptyPartCounts();
  let obstaclesCleared = 0;
  let obstaclesUnlocked = 0;
  let matches = findMatches(board);
  let anomalyTicked = false;
  let cascades = 0;

  while (matches.size > 0 && cascades < 20) {
    const affected = new Set<string>();
    for (const key of matches) {
      const [row, column] = key.split(":").map(Number) as [number, number];
      const tile = board[row]![column]!;
      if (tile.kind) partsMatched[tile.kind] += 1;
      if (tile.kind === targetPart) targetMatched += 1;
      neighborsOf(row, column).forEach(({ row: nextRow, column: nextColumn }) =>
        affected.add(`${nextRow}:${nextColumn}`),
      );
    }

    for (const key of affected) {
      const [row, column] = key.split(":").map(Number) as [number, number];
      const tile = board[row]![column]!;
      if (tile.frozen) {
        board[row]![column] = { ...tile, frozen: false };
        obstaclesUnlocked += 1;
      } else if (tile.junk) {
        board[row]![column] = emptyTile();
        obstaclesCleared += 1;
      }
    }
    for (const key of matches) {
      const [row, column] = key.split(":").map(Number) as [number, number];
      board[row]![column] = emptyTile();
    }

    if (!anomalyTicked) {
      for (const line of board) {
        line.forEach((tile, column) => {
          if (tile.anomalyTurns === null || tile.kind === null) return;
          if (tile.anomalyTurns <= 1) {
            line[column] = { ...emptyTile(), junk: true };
          } else {
            line[column] = { ...tile, anomalyTurns: tile.anomalyTurns - 1 };
          }
        });
      }
      anomalyTicked = true;
    }

    collapseBoard(board);
    matches = findMatches(board);
    cascades += 1;
  }
  return {
    board,
    targetMatched,
    partsMatched,
    obstaclesCleared,
    obstaclesUnlocked,
  };
};

export const applyMatch3Move = (
  sourceBoard: Match3Board,
  from: Match3Position,
  to: Match3Position,
  targetPart: Match3PartKey,
): Match3MoveResult => {
  const board = sourceBoard.map((line) => line.map((tile) => ({ ...tile })));
  const validPosition = ({ row, column }: Match3Position) =>
    Number.isInteger(row) &&
    Number.isInteger(column) &&
    row >= 0 &&
    row < MATCH3_BOARD_SIZE &&
    column >= 0 &&
    column < MATCH3_BOARD_SIZE;
  const adjacent =
    Math.abs(from.row - to.row) + Math.abs(from.column - to.column) === 1;
  if (!validPosition(from) || !validPosition(to) || !adjacent) {
    return rejectedMove(board);
  }
  const first = board[from.row]?.[from.column];
  const second = board[to.row]?.[to.column];
  if (!canMatch(first) || !canMatch(second)) {
    return rejectedMove(board);
  }
  board[from.row]![from.column] = second;
  board[to.row]![to.column] = first;
  if (findMatches(board).size === 0) {
    return rejectedMove(sourceBoard);
  }
  return { accepted: true, ...resolveMatches(board, targetPart) };
};

export const findMatch3Hint = (
  board: Match3Board,
  targetPart: Match3PartKey,
): Match3Hint | null => {
  let fallback: Match3Hint | null = null;
  let bestTargetMatch = 0;
  for (let row = 0; row < MATCH3_BOARD_SIZE; row += 1) {
    for (let column = 0; column < MATCH3_BOARD_SIZE; column += 1) {
      const from = { row, column };
      for (const to of [
        ...(column < MATCH3_BOARD_SIZE - 1
          ? [{ row, column: column + 1 }]
          : []),
        ...(row < MATCH3_BOARD_SIZE - 1 ? [{ row: row + 1, column }] : []),
      ]) {
        if (
          !canMatch(board[from.row]?.[from.column]) ||
          !canMatch(board[to.row]?.[to.column])
        ) {
          continue;
        }
        const next = board.map((line) => line.map((tile) => ({ ...tile })));
        [next[from.row]![from.column], next[to.row]![to.column]] = [
          next[to.row]![to.column]!,
          next[from.row]![from.column]!,
        ];
        const matches = findMatches(next);
        if (matches.size === 0) continue;
        const hint = { from, to };
        fallback ??= hint;
        const targetMatches = [...matches].filter((key) => {
          const [matchedRow, matchedColumn] = key.split(":").map(Number) as [
            number,
            number,
          ];
          return next[matchedRow]![matchedColumn]!.kind === targetPart;
        }).length;
        if (targetMatches > bestTargetMatch) {
          bestTargetMatch = targetMatches;
          fallback = hint;
        }
      }
    }
  }
  return fallback;
};

export const applyMatch3Booster = (
  sourceBoard: Match3Board,
  targetPart: Match3PartKey,
  boosterId: Match3BoosterKey,
  target: Match3Position,
): Match3MoveResult => {
  if (
    !Number.isInteger(target.row) ||
    !Number.isInteger(target.column) ||
    target.row < 0 ||
    target.row >= MATCH3_BOARD_SIZE ||
    target.column < 0 ||
    target.column >= MATCH3_BOARD_SIZE
  ) {
    return rejectedMove(sourceBoard);
  }

  const board = sourceBoard.map((line) => line.map((tile) => ({ ...tile })));
  const cells =
    boosterId === "row_rocket"
      ? Array.from({ length: MATCH3_BOARD_SIZE }, (_, column) => ({
          row: target.row,
          column,
        }))
      : Array.from({ length: MATCH3_BOARD_SIZE }, (_, row) =>
          Array.from({ length: MATCH3_BOARD_SIZE }, (_, column) => ({
            row,
            column,
          })).filter(
            ({ row: targetRow, column: targetColumn }) =>
              Math.abs(targetRow - target.row) <= 1 &&
              Math.abs(targetColumn - target.column) <= 1,
          ),
        ).flat();

  const partsMatched = emptyPartCounts();
  let targetMatched = 0;
  let obstaclesCleared = 0;
  let obstaclesUnlocked = 0;
  for (const { row, column } of cells) {
    const tile = board[row]![column]!;
    if (tile.kind && !tile.junk) {
      partsMatched[tile.kind] += 1;
      if (tile.kind === targetPart) targetMatched += 1;
    }
    if (tile.junk) obstaclesCleared += 1;
    if (tile.frozen) obstaclesUnlocked += 1;
    board[row]![column] = emptyTile();
  }

  collapseBoard(board);
  const cascade = resolveMatches(board, targetPart);
  for (const part of MATCH3_PARTS) {
    partsMatched[part.key] += cascade.partsMatched[part.key];
  }
  return {
    accepted: true,
    board: cascade.board,
    targetMatched: targetMatched + cascade.targetMatched,
    partsMatched,
    obstaclesCleared: obstaclesCleared + cascade.obstaclesCleared,
    obstaclesUnlocked: obstaclesUnlocked + cascade.obstaclesUnlocked,
  };
};

export const isMatch3Board = (value: unknown): value is Match3Board =>
  Array.isArray(value) &&
  value.length === MATCH3_BOARD_SIZE &&
  value.every(
    (line) =>
      Array.isArray(line) &&
      line.length === MATCH3_BOARD_SIZE &&
      line.every(
        (tile) =>
          typeof tile === "object" &&
          tile !== null &&
          "kind" in tile &&
          (tile.kind === null ||
            (typeof tile.kind === "string" && partKeys.has(tile.kind))) &&
          typeof tile.frozen === "boolean" &&
          typeof tile.junk === "boolean" &&
          (tile.anomalyTurns === null ||
            (typeof tile.anomalyTurns === "number" &&
              Number.isInteger(tile.anomalyTurns))),
      ),
  );
