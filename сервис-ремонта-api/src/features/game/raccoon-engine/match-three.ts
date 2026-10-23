export const BOARD_ROWS = 7;
export const BOARD_COLUMNS = 6;

export const PARTS = ["cpu", "gpu", "ram", "ssd", "board", "fan"] as const;
export type PartKind = (typeof PARTS)[number] | "gold";
export type GameBoard = (PartKind | null)[][];
export type Position = { readonly row: number; readonly column: number };
export type BoardObstacleKind = "crate" | "circuit";
export type BoardObstacle = {
  readonly kind: BoardObstacleKind;
  readonly position: Position;
};
export type ObjectiveKind = PartKind | BoardObstacleKind;
export type PartCounts = Partial<Record<ObjectiveKind, number>>;
export type BoardRules = {
  readonly parts?: readonly PartKind[];
  readonly shape?: readonly (readonly boolean[])[];
  readonly obstacles?: readonly BoardObstacle[];
};

export const FINAL_BOSS_LEVEL = 100;
export const FINAL_BOSS_PARTS: readonly PartKind[] = [
  "cpu",
  "cpu",
  "cpu",
  "gpu",
  "ram",
  "ssd",
  "board",
  "fan",
  "gold",
  "gold",
  "gold",
  "gold",
  "gold",
  "gold",
  "gold",
  "gold",
];
export const FINAL_BOSS_BOARD_RULES: BoardRules = {
  parts: FINAL_BOSS_PARTS,
  shape: [
    [false, false, true, true, true, false, false],
    [false, true, true, true, true, true, false],
    [true, true, true, true, true, true, true],
    [true, true, true, true, true, true, true],
    [true, true, true, true, true, true, true],
    [false, true, true, true, true, true, false],
    [false, false, true, true, true, false, false],
  ],
};

export type Resolution = {
  readonly board: GameBoard;
  readonly collected: PartCounts;
  readonly destroyedObstacles: readonly BoardObstacle[];
  readonly score: number;
  readonly cascades: number;
  readonly tilesCleared: number;
};

export type LevelConfig = {
  readonly goals: PartCounts;
  readonly moves: number;
  readonly workshopPart: PartKind;
  readonly finalBoss?: boolean;
};

export const PART_INFO: Record<ObjectiveKind, { readonly name: string }> = {
  cpu: { name: "Процессор" },
  gpu: { name: "Видеокарта" },
  ram: { name: "Память" },
  ssd: { name: "SSD" },
  board: { name: "Материнская плата" },
  fan: { name: "Кулер" },
  gold: { name: "Золотой чип" },
  crate: { name: "Ящик" },
  circuit: { name: "Электрическая цепь" },
};

const cloneBoard = (board: GameBoard): GameBoard =>
  board.map((row) => [...row]);
const keyFor = ({ row, column }: Position): string => `${row}:${column}`;

export const findMatches = (
  board: GameBoard,
  rules: BoardRules = {},
): Position[] => {
  const matches = new Map<string, Position>();
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const blocked = new Set(
    rules.obstacles?.map(({ position }) => keyFor(position)) ?? [],
  );
  for (let row = 0; row < rows; row += 1) {
    let start = 0;
    while (start < columns) {
      const kind = board[row]?.[start] ?? null;
      if (kind === null || blocked.has(keyFor({ row, column: start }))) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (
        end < columns &&
        !blocked.has(keyFor({ row, column: end })) &&
        board[row]?.[end] === kind
      ) {
        end += 1;
      }
      if (end - start >= 3) {
        for (let column = start; column < end; column += 1) {
          const position = { row, column };
          matches.set(keyFor(position), position);
        }
      }
      start = end;
    }
  }
  for (let column = 0; column < columns; column += 1) {
    let start = 0;
    while (start < rows) {
      const kind = board[start]?.[column] ?? null;
      if (kind === null || blocked.has(keyFor({ row: start, column }))) {
        start += 1;
        continue;
      }
      let end = start + 1;
      while (
        end < rows &&
        !blocked.has(keyFor({ row: end, column })) &&
        board[end]?.[column] === kind
      ) {
        end += 1;
      }
      if (end - start >= 3) {
        for (let row = start; row < end; row += 1) {
          const position = { row, column };
          matches.set(keyFor(position), position);
        }
      }
      start = end;
    }
  }
  return [...matches.values()];
};

const makeBoard = (random: () => number, rules: BoardRules): GameBoard => {
  const parts = rules.parts?.length ? rules.parts : PARTS;
  const rows = rules.shape?.length ?? BOARD_ROWS;
  const columns = rules.shape?.[0]?.length ?? BOARD_COLUMNS;
  const board: GameBoard = [];
  for (let row = 0; row < rows; row += 1) {
    const nextRow: GameBoard[number] = [];
    for (let column = 0; column < columns; column += 1) {
      if (rules.shape && !rules.shape[row]?.[column]) {
        nextRow.push(null);
        continue;
      }
      const options = parts.filter((kind) => {
        const horizontal =
          column >= 2 &&
          nextRow[column - 1] === kind &&
          nextRow[column - 2] === kind;
        const vertical =
          row >= 2 &&
          board[row - 1]?.[column] === kind &&
          board[row - 2]?.[column] === kind;
        return !horizontal && !vertical;
      });
      const selectedPart = options[Math.floor(random() * options.length)];
      if (selectedPart === undefined) {
        throw new Error("Board rules must include at least one playable part.");
      }
      nextRow.push(selectedPart);
    }
    board.push(nextRow);
  }
  return board;
};

const swapOnCopy = (
  board: GameBoard,
  first: Position,
  second: Position,
): GameBoard => {
  const next = cloneBoard(board);
  const firstRow = next[first.row];
  const secondRow = next[second.row];
  if (
    !firstRow ||
    !secondRow ||
    first.column >= firstRow.length ||
    second.column >= secondRow.length
  ) {
    return next;
  }
  const firstPart = firstRow[first.column];
  const secondPart = secondRow[second.column];
  if (firstPart === undefined || secondPart === undefined) return next;
  firstRow[first.column] = secondPart;
  secondRow[second.column] = firstPart;
  return next;
};

export const findPossibleMove = (
  board: GameBoard,
  rules: BoardRules = {},
): readonly [Position, Position] | null => {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const blocked = new Set(
    rules.obstacles?.map(({ position }) => keyFor(position)) ?? [],
  );
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      if (board[row]?.[column] == null || blocked.has(keyFor({ row, column })))
        continue;
      const first = { row, column };
      const neighbors = [
        ...(column + 1 < columns ? [{ row, column: column + 1 }] : []),
        ...(row + 1 < rows ? [{ row: row + 1, column }] : []),
      ];
      for (const second of neighbors) {
        if (
          board[second.row]?.[second.column] != null &&
          !blocked.has(keyFor(second)) &&
          findMatches(swapOnCopy(board, first, second), rules).length > 0
        ) {
          return [first, second];
        }
      }
    }
  }
  return null;
};

export const hasPossibleMoves = (
  board: GameBoard,
  rules: BoardRules = {},
): boolean => findPossibleMove(board, rules) !== null;

export const createBoard = (
  random: () => number = Math.random,
  rules: BoardRules = {},
): GameBoard => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const board = makeBoard(random, rules);
    if (hasPossibleMoves(board, rules)) return board;
  }
  const parts = rules.parts?.length ? rules.parts : PARTS;
  const rows = rules.shape?.length ?? BOARD_ROWS;
  const columns = rules.shape?.[0]?.length ?? BOARD_COLUMNS;
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) =>
      rules.shape && !rules.shape[row]?.[column]
        ? null
        : (parts[(row * 2 + column) % parts.length] ?? PARTS[0]),
    ),
  );
};

const countCollected = (counts: PartCounts, kind: PartKind): void => {
  counts[kind] = (counts[kind] ?? 0) + 1;
};

const collapseAndRefill = (
  board: GameBoard,
  removed: Set<string>,
  random: () => number,
  parts: readonly PartKind[],
  obstacles: readonly BoardObstacle[],
): void => {
  const rows = board.length;
  const columns = board[0]?.length ?? 0;
  const blocked = new Set(obstacles.map(({ position }) => keyFor(position)));
  for (let column = 0; column < columns; column += 1) {
    let row = rows - 1;
    while (row >= 0) {
      if (
        board[row]?.[column] == null ||
        blocked.has(keyFor({ row, column }))
      ) {
        row -= 1;
        continue;
      }
      const segmentBottom = row;
      while (
        row >= 0 &&
        board[row]?.[column] != null &&
        !blocked.has(keyFor({ row, column }))
      ) {
        row -= 1;
      }
      const segmentTop = row + 1;
      const survivors: PartKind[] = [];
      for (
        let segmentRow = segmentBottom;
        segmentRow >= segmentTop;
        segmentRow -= 1
      ) {
        const cell = board[segmentRow]?.[column];
        if (!removed.has(`${segmentRow}:${column}`) && cell != null)
          survivors.push(cell);
      }
      for (
        let segmentRow = segmentBottom;
        segmentRow >= segmentTop;
        segmentRow -= 1
      ) {
        const rowValues = board[segmentRow];
        if (!rowValues) continue;
        const refill = parts[Math.floor(random() * parts.length)];
        if (refill === undefined) {
          throw new Error(
            "Board rules must include at least one playable part.",
          );
        }
        rowValues[column] = survivors[segmentBottom - segmentRow] ?? refill;
      }
    }
  }
};

export const clearAndResolve = (
  board: GameBoard,
  positions: readonly Position[],
  random: () => number = Math.random,
  rules: BoardRules = {},
): Resolution | null => {
  const next = cloneBoard(board);
  const collected: PartCounts = {};
  const activeObstacles = new Map(
    (rules.obstacles ?? []).map((obstacle) => [
      keyFor(obstacle.position),
      obstacle,
    ]),
  );
  const destroyedObstacles = new Map<string, BoardObstacle>();
  let pending = [
    ...new Map(
      positions.map((position) => [keyFor(position), position]),
    ).values(),
  ];
  let score = 0;
  let cascades = 0;
  let tilesCleared = 0;

  while (pending.length > 0 && cascades < 20) {
    for (const [key, obstacle] of activeObstacles) {
      const directlyHit = pending.some((position) => keyFor(position) === key);
      const connectedMatch = pending.some((position) => {
        const adjacent =
          Math.abs(position.row - obstacle.position.row) +
            Math.abs(position.column - obstacle.position.column) ===
          1;
        return (
          adjacent &&
          (obstacle.kind === "crate" ||
            next[position.row]?.[position.column] === "cpu")
        );
      });
      if (!directlyHit && !connectedMatch) continue;
      activeObstacles.delete(key);
      destroyedObstacles.set(key, obstacle);
    }

    const removed = new Set(pending.map(keyFor));
    for (const position of pending) {
      const part = next[position.row]?.[position.column];
      if (part != null) countCollected(collected, part);
    }
    tilesCleared += pending.length;
    score += pending.length * 100 + Math.max(0, cascades) * 150;
    if (pending.length >= 5) score += 500;
    else if (pending.length === 4) score += 250;
    collapseAndRefill(next, removed, random, rules.parts ?? PARTS, [
      ...activeObstacles.values(),
    ]);
    pending = findMatches(next, {
      ...rules,
      obstacles: [...activeObstacles.values()],
    });
    cascades += 1;
  }

  return tilesCleared > 0
    ? {
        board: next,
        collected,
        destroyedObstacles: [...destroyedObstacles.values()],
        score,
        cascades,
        tilesCleared,
      }
    : null;
};

export const swapAndResolve = (
  board: GameBoard,
  first: Position,
  second: Position,
  random: () => number = Math.random,
  rules: BoardRules = {},
): Resolution | null => {
  if (
    Math.abs(first.row - second.row) +
      Math.abs(first.column - second.column) !==
    1
  )
    return null;
  if (
    board[first.row]?.[first.column] == null ||
    board[second.row]?.[second.column] == null
  ) {
    return null;
  }
  const blocked = new Set(
    rules.obstacles?.map(({ position }) => keyFor(position)) ?? [],
  );
  if (blocked.has(keyFor(first)) || blocked.has(keyFor(second))) return null;
  const swapped = swapOnCopy(board, first, second);
  const matches = findMatches(swapped, rules);
  return matches.length > 0
    ? clearAndResolve(swapped, matches, random, rules)
    : null;
};

export const shuffleBoard = (
  board: GameBoard,
  random: () => number = Math.random,
  rules: BoardRules = {},
): GameBoard => {
  const blocked = new Set(
    rules.obstacles?.map(({ position }) => keyFor(position)) ?? [],
  );
  const playableCells = board.flatMap((row, rowIndex) =>
    row.flatMap((part, columnIndex) =>
      part === null ||
      blocked.has(keyFor({ row: rowIndex, column: columnIndex }))
        ? []
        : [{ row: rowIndex, column: columnIndex, part }],
    ),
  );
  const parts = playableCells.map(({ part }) => part);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const shuffled = [...parts];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(random() * (index + 1));
      const current = shuffled[index];
      const replacement = shuffled[target];
      if (current === undefined || replacement === undefined) {
        throw new Error("The board shuffle produced an invalid index.");
      }
      shuffled[index] = replacement;
      shuffled[target] = current;
    }
    const candidate = cloneBoard(board);
    playableCells.forEach(({ row, column }, index) => {
      const rowValues = candidate[row];
      const part = shuffled[index];
      if (!rowValues || part === undefined) {
        throw new Error("The board shuffle produced an invalid cell.");
      }
      rowValues[column] = part;
    });
    if (
      findMatches(candidate, rules).length === 0 &&
      hasPossibleMoves(candidate, rules)
    ) {
      return candidate;
    }
  }
  return createBoard(random, {
    ...rules,
    shape: rules.shape ?? board.map((row) => row.map((part) => part !== null)),
    parts: rules.parts ?? [...new Set(parts)],
  });
};

const levelPartSets: readonly (readonly PartKind[])[] = [
  ["cpu", "gpu", "ram"],
  ["ssd", "board", "fan"],
  ["cpu", "gpu", "ssd"],
  ["ram", "board", "fan"],
  ["cpu", "ssd", "fan"],
  ["gpu", "ram", "board"],
];

const firstTenLevels: readonly LevelConfig[] = [
  { goals: { cpu: 4, gpu: 4 }, moves: 20, workshopPart: "cpu" },
  { goals: { gpu: 5, ram: 5 }, moves: 20, workshopPart: "gpu" },
  { goals: { ram: 6, ssd: 6 }, moves: 19, workshopPart: "ram" },
  { goals: { cpu: 5, gpu: 5, ram: 5 }, moves: 19, workshopPart: "cpu" },
  { goals: { ssd: 6, board: 6, fan: 6 }, moves: 18, workshopPart: "board" },
  { goals: { cpu: 6, ssd: 6, fan: 7 }, moves: 18, workshopPart: "fan" },
  { goals: { gpu: 7, ram: 7, board: 7 }, moves: 17, workshopPart: "board" },
  { goals: { cpu: 7, board: 8, fan: 8 }, moves: 17, workshopPart: "cpu" },
  { goals: { cpu: 8, gpu: 8, ssd: 8 }, moves: 16, workshopPart: "ssd" },
  { goals: { cpu: 7, gpu: 7, ram: 7, ssd: 7 }, moves: 16, workshopPart: "gpu" },
];

export const getLevelConfig = (level: number): LevelConfig => {
  const requestedLevel = Number.isFinite(level) ? Math.floor(level) : 1;
  const safeLevel = Math.min(FINAL_BOSS_LEVEL, Math.max(1, requestedLevel));
  if (safeLevel <= firstTenLevels.length) {
    const firstLevel = firstTenLevels[safeLevel - 1];
    if (firstLevel) return firstLevel;
  }
  if (safeLevel === FINAL_BOSS_LEVEL) {
    return {
      goals: { gold: 100, crate: 2, circuit: 2 },
      moves: 70,
      workshopPart: "gold",
      finalBoss: true,
    };
  }

  const levelAfterTen = safeLevel - firstTenLevels.length - 1;
  const chapter = Math.floor((safeLevel - 1) / 20);
  const step = levelAfterTen % levelPartSets.length;
  const parts = levelPartSets[step];
  if (!parts) throw new Error("The requested level has no part schedule.");
  const goals: PartCounts = {};
  if (safeLevel >= 21 && safeLevel <= 40) {
    goals.crate = 2 + Math.floor((safeLevel - 21) / 5);
  } else if (safeLevel >= 41 && safeLevel <= 60) {
    goals.circuit = 2 + Math.floor((safeLevel - 41) / 5);
  } else if (safeLevel >= 81 && safeLevel < FINAL_BOSS_LEVEL) {
    const obstacleGoal = 2 + Math.floor((safeLevel - 81) / 10);
    goals.crate = obstacleGoal;
    goals.circuit = obstacleGoal;
  }
  const obstacleGoalTotal = (goals.crate ?? 0) + (goals.circuit ?? 0);
  const totalGoalCount = 30 + Math.floor(((safeLevel - 11) * 7) / 25);
  const partGoalTotal = Math.max(
    parts.length * 3,
    totalGoalCount - obstacleGoalTotal,
  );
  const basePartGoal = Math.floor(partGoalTotal / parts.length);
  const extraPartGoals = partGoalTotal % parts.length;
  parts.forEach((kind, index) => {
    goals[kind] = basePartGoal + (index < extraPartGoals ? 1 : 0);
  });
  const workshopPart = parts[(chapter + step) % parts.length];
  if (!workshopPart)
    throw new Error("The requested level has no workshop part.");
  return {
    goals,
    moves: safeLevel <= 40 ? 15 : safeLevel <= 70 ? 14 : 13,
    workshopPart,
  };
};

export const levelGoals = (level: number): PartCounts =>
  getLevelConfig(level).goals;

export const starRating = (score: number, level: number): number => {
  const goalTotal = Object.values(levelGoals(level)).reduce(
    (sum, count) => sum + (count ?? 0),
    0,
  );
  if (score >= goalTotal * 150) return 3;
  if (score >= goalTotal * 95) return 2;
  return score > 0 ? 1 : 0;
};
