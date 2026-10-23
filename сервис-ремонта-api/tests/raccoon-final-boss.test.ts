import assert from "node:assert/strict";
import { test } from "node:test";

import { createChapterMechanics } from "../src/features/game/raccoon-engine/chapter-mechanics.js";
import {
  MAGNET_CHARGE_SIZE,
  getElectricBlockPositions,
  moveElectricBlockObstacles,
} from "../src/features/game/raccoon-engine/final-boss.js";
import {
  type GameBoard,
  getLevelConfig,
} from "../src/features/game/raccoon-engine/match-three.js";
import {
  applyRaccoonMove,
  createRaccoonGameState,
} from "../src/features/game/raccoon-game-state.js";

test("level 100 asks for exactly 100 gold crystals", () => {
  assert.deepEqual(getLevelConfig(100).goals, { gold: 100 });
});

test("four electric blocks rotate around the gear perimeter", () => {
  const obstacles = createChapterMechanics(100).obstacles;
  const startingCircuits = obstacles.filter(({ kind }) => kind === "circuit");
  const moved = moveElectricBlockObstacles(obstacles, 1);

  assert.equal(startingCircuits.length, 4);
  assert.deepEqual(
    startingCircuits.map(({ position }) => position),
    getElectricBlockPositions(0),
  );
  assert.deepEqual(
    moved
      .filter(({ kind }) => kind === "circuit")
      .map(({ position }) => position),
    getElectricBlockPositions(1),
  );
  assert.deepEqual(
    moved.filter(({ kind }) => kind === "crate"),
    obstacles.filter(({ kind }) => kind === "crate"),
  );
});

test("magnetic pulse charges every 20 blue processors", () => {
  assert.equal(MAGNET_CHARGE_SIZE, 20);
});

test("accepted final-level moves shift the electric blocks", () => {
  const initial = createRaccoonGameState(100);
  const board = initial.board.map((row) => [...row]) as GameBoard;
  const middleRow = board[2];
  assert.ok(middleRow);
  middleRow[2] = "cpu";
  middleRow[3] = "gpu";
  middleRow[4] = "cpu";
  middleRow[5] = "cpu";
  middleRow[6] = "fan";

  const state = {
    ...initial,
    board,
    obstacles: createChapterMechanics(100).obstacles.filter(
      ({ kind }) => kind === "circuit",
    ),
  };
  const result = applyRaccoonMove(
    state,
    100,
    { row: 2, column: 3 },
    { row: 2, column: 2 },
  );

  assert.equal(result.accepted, true);
  assert.equal(result.state.electricShift, 1);
  assert.deepEqual(
    result.state.obstacles.map(({ position }) => position),
    getElectricBlockPositions(1),
  );
});
