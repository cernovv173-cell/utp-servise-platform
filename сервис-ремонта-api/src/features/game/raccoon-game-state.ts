import {
  createChapterMechanics,
  moveConveyor,
} from "./raccoon-engine/chapter-mechanics.js";
import {
  MAGNET_CHARGE_SIZE,
  magnetizeGoldToCenter,
  moveElectricBlockObstacles,
} from "./raccoon-engine/final-boss.js";
import {
  type BoosterCounts,
  type BoosterKind,
  createInitialBoosters,
  getBoosterTargets,
} from "./raccoon-engine/game-boosters.js";
import {
  createEmptyPartCounts,
  sumPartCounts,
} from "./raccoon-engine/game-counts.js";
import {
  type BoardObstacle,
  type BoardRules,
  FINAL_BOSS_BOARD_RULES,
  FINAL_BOSS_LEVEL,
  type GameBoard,
  type PartCounts,
  type Position,
  clearAndResolve,
  createBoard,
  findPossibleMove,
  getLevelConfig,
  hasPossibleMoves,
  shuffleBoard,
  starRating,
  swapAndResolve,
} from "./raccoon-engine/match-three.js";

export type RaccoonGameState = {
  readonly version: 1;
  readonly board: GameBoard;
  readonly collected: PartCounts;
  readonly movesLeft: number;
  readonly score: number;
  readonly obstacles: readonly BoardObstacle[];
  readonly conveyorRow: number | null;
  readonly conveyorTurn: number;
  readonly boosters: BoosterCounts;
  readonly electricShift: number;
  readonly magnetUses: number;
};

export type RaccoonSessionStatus = "ACTIVE" | "COMPLETE" | "FAILED";

export type RaccoonActionResult = {
  readonly accepted: boolean;
  readonly state: RaccoonGameState;
  readonly status: RaccoonSessionStatus;
  readonly targetCollected: number;
  readonly stars: number;
};

export const raccoonRulesForLevel = (
  level: number,
  obstacles: readonly BoardObstacle[],
): BoardRules => ({
  ...(level === FINAL_BOSS_LEVEL ? FINAL_BOSS_BOARD_RULES : {}),
  obstacles,
});

export const createRaccoonGameState = (level: number): RaccoonGameState => {
  const mechanics = createChapterMechanics(level);
  const rules = raccoonRulesForLevel(level, mechanics.obstacles);
  return {
    version: 1,
    board: createBoard(Math.random, rules),
    collected: createEmptyPartCounts(),
    movesLeft: getLevelConfig(level).moves,
    score: 0,
    obstacles: mechanics.obstacles,
    conveyorRow: mechanics.conveyorRow,
    conveyorTurn: 0,
    boosters: createInitialBoosters(),
    electricShift: 0,
    magnetUses: 0,
  };
};

const isGoalComplete = (level: number, collected: PartCounts): boolean =>
  Object.entries(getLevelConfig(level).goals).every(
    ([key, amount]) =>
      (collected[key as keyof PartCounts] ?? 0) >= (amount ?? 0),
  );

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonnegativeInteger = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

const isPlayablePosition = (
  state: RaccoonGameState,
  position: Position,
): boolean => {
  if (
    !Number.isInteger(position.row) ||
    !Number.isInteger(position.column) ||
    position.row < 0 ||
    position.row >= state.board.length
  ) {
    return false;
  }
  const row = state.board[position.row];
  return Boolean(
    row &&
    position.column >= 0 &&
    position.column < row.length &&
    row[position.column] !== null,
  );
};

const resultFor = (
  state: RaccoonGameState,
  level: number,
  status: RaccoonSessionStatus,
  accepted: boolean,
): RaccoonActionResult => ({
  accepted,
  state,
  status,
  targetCollected: sumPartCounts(state.collected),
  stars: starRating(state.score, level),
});

const resolveClear = (
  state: RaccoonGameState,
  level: number,
  result: NonNullable<ReturnType<typeof clearAndResolve>>,
  spendsMove: boolean,
): RaccoonActionResult => {
  const collected: PartCounts = { ...state.collected };
  for (const [part, count] of Object.entries(result.collected)) {
    const key = part as keyof PartCounts;
    collected[key] = (collected[key] ?? 0) + (count ?? 0);
  }
  for (const obstacle of result.destroyedObstacles) {
    collected[obstacle.kind] = (collected[obstacle.kind] ?? 0) + 1;
  }

  const destroyed = new Set(
    result.destroyedObstacles.map(
      ({ kind, position }) => `${kind}:${position.row}:${position.column}`,
    ),
  );
  const remainingObstacles = state.obstacles.filter(
    ({ kind, position }) =>
      !destroyed.has(`${kind}:${position.row}:${position.column}`),
  );
  const electricShift =
    state.electricShift + (spendsMove && level === FINAL_BOSS_LEVEL ? 1 : 0);
  const obstacles =
    spendsMove && level === FINAL_BOSS_LEVEL
      ? moveElectricBlockObstacles(remainingObstacles, electricShift)
      : remainingObstacles;
  const rules = raccoonRulesForLevel(level, obstacles);
  const conveyorTurn = state.conveyorTurn + (spendsMove ? 1 : 0);
  let board = spendsMove
    ? moveConveyor(
        result.board,
        state.conveyorRow,
        state.conveyorTurn,
        raccoonRulesForLevel(level, remainingObstacles),
      )
    : result.board;
  if (!hasPossibleMoves(board, rules))
    board = shuffleBoard(board, Math.random, rules);

  const movesLeft = state.movesLeft - (spendsMove ? 1 : 0);
  const score = state.score + result.score;
  const nextState: RaccoonGameState = {
    ...state,
    board,
    collected,
    obstacles,
    conveyorTurn,
    movesLeft,
    score,
    electricShift,
  };
  const status = isGoalComplete(level, collected)
    ? "COMPLETE"
    : movesLeft <= 0
      ? "FAILED"
      : "ACTIVE";
  return resultFor(nextState, level, status, true);
};

export const applyRaccoonMove = (
  state: RaccoonGameState,
  level: number,
  from: Position,
  to: Position,
): RaccoonActionResult => {
  const adjacent =
    Math.abs(from.row - to.row) + Math.abs(from.column - to.column) === 1;
  if (
    !adjacent ||
    !isPlayablePosition(state, from) ||
    !isPlayablePosition(state, to)
  ) {
    return resultFor(state, level, "ACTIVE", false);
  }
  if (state.movesLeft <= 0) return resultFor(state, level, "FAILED", false);
  const resolution = swapAndResolve(
    state.board,
    from,
    to,
    Math.random,
    raccoonRulesForLevel(level, state.obstacles),
  );
  return resolution
    ? resolveClear(state, level, resolution, true)
    : resultFor(state, level, "ACTIVE", false);
};

export const applyRaccoonBooster = (
  state: RaccoonGameState,
  level: number,
  booster: BoosterKind,
  target: Position,
): RaccoonActionResult => {
  if (!isPlayablePosition(state, target) || state.boosters[booster] <= 0)
    return resultFor(state, level, "ACTIVE", false);
  const resolution = clearAndResolve(
    state.board,
    getBoosterTargets(booster, target, state.board),
    Math.random,
    raccoonRulesForLevel(level, state.obstacles),
  );
  if (!resolution) return resultFor(state, level, "ACTIVE", false);
  const result = resolveClear(state, level, resolution, false);
  return {
    ...result,
    state: {
      ...result.state,
      boosters: {
        ...state.boosters,
        [booster]: state.boosters[booster] - 1,
      },
    },
  };
};

export const applyRaccoonMagnet = (
  state: RaccoonGameState,
  level: number,
): RaccoonActionResult => {
  const available =
    Math.floor((state.collected.cpu ?? 0) / MAGNET_CHARGE_SIZE) -
    state.magnetUses;
  if (level !== FINAL_BOSS_LEVEL || available <= 0) {
    return resultFor(state, level, "ACTIVE", false);
  }
  return resultFor(
    {
      ...state,
      board: magnetizeGoldToCenter(state.board),
      magnetUses: state.magnetUses + 1,
    },
    level,
    "ACTIVE",
    true,
  );
};

export const getRaccoonHint = (state: RaccoonGameState, level: number) =>
  findPossibleMove(state.board, raccoonRulesForLevel(level, state.obstacles));

export const raccoonSnapshot = (
  id: string,
  level: number,
  status: RaccoonSessionStatus,
  state: RaccoonGameState,
) => ({
  id,
  level,
  status,
  board: state.board,
  goals: getLevelConfig(level).goals,
  collected: state.collected,
  movesLeft: state.movesLeft,
  movesTotal: getLevelConfig(level).moves,
  score: state.score,
  stars: starRating(state.score, level),
  obstacles: state.obstacles,
  conveyorRow: state.conveyorRow,
  conveyorTurn: state.conveyorTurn,
  boosters: state.boosters,
  electricShift: state.electricShift,
  magnetCharges: Math.max(
    0,
    Math.floor((state.collected.cpu ?? 0) / MAGNET_CHARGE_SIZE) -
      state.magnetUses,
  ),
});

export const isRaccoonGameState = (
  value: unknown,
  level: number,
): value is RaccoonGameState => {
  if (!isRecord(value)) return false;
  const state = value as unknown as Partial<RaccoonGameState>;
  const expectedColumns = level === FINAL_BOSS_LEVEL ? 7 : 6;
  const validParts = ["cpu", "gpu", "ram", "ssd", "board", "fan", "gold"];
  const validObjectives = [...validParts, "crate", "circuit"];
  const collectedIsValid =
    isRecord(state.collected) &&
    Object.entries(state.collected).every(
      ([key, count]) =>
        validObjectives.includes(key) && isNonnegativeInteger(count),
    );
  const boostersAreValid =
    isRecord(state.boosters) &&
    ["hammer", "rocket", "bomb"].every((booster) =>
      isNonnegativeInteger(state.boosters?.[booster as keyof BoosterCounts]),
    );
  const obstaclesAreValid =
    Array.isArray(state.obstacles) &&
    state.obstacles.every(
      (obstacle) =>
        isRecord(obstacle) &&
        (obstacle.kind === "crate" || obstacle.kind === "circuit") &&
        isRecord(obstacle.position) &&
        isNonnegativeInteger(obstacle.position.row) &&
        isNonnegativeInteger(obstacle.position.column) &&
        obstacle.position.row < 7 &&
        obstacle.position.column < expectedColumns,
    );
  return (
    state.version === 1 &&
    Array.isArray(state.board) &&
    state.board.length === 7 &&
    state.board.every(
      (row) =>
        Array.isArray(row) &&
        row.length === expectedColumns &&
        row.every(
          (cell) => cell === null || validParts.includes(cell as string),
        ),
    ) &&
    collectedIsValid &&
    isNonnegativeInteger(state.movesLeft) &&
    isNonnegativeInteger(state.score) &&
    obstaclesAreValid &&
    (state.conveyorRow === null ||
      (isNonnegativeInteger(state.conveyorRow) && state.conveyorRow < 7)) &&
    isNonnegativeInteger(state.conveyorTurn) &&
    boostersAreValid &&
    isNonnegativeInteger(state.electricShift) &&
    isNonnegativeInteger(state.magnetUses)
  );
};
