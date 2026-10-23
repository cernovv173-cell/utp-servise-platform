import assert from "node:assert/strict";
import { test } from "node:test";

import { MAGNET_CHARGE_SIZE } from "../src/features/game/raccoon-engine/final-boss.js";
import {
  applyRaccoonBooster,
  applyRaccoonMagnet,
  applyRaccoonMove,
  createRaccoonGameState,
  getRaccoonHint,
  isRaccoonGameState,
} from "../src/features/game/raccoon-game-state.js";

test("new levels preserve the source game board shapes and playable hints", () => {
  const firstLevel = createRaccoonGameState(1);
  const finalLevel = createRaccoonGameState(100);

  assert.equal(firstLevel.board.length, 7);
  assert.ok(firstLevel.board.every((row) => row.length === 6));
  assert.ok(isRaccoonGameState(firstLevel, 1));
  assert.equal(finalLevel.board.length, 7);
  assert.ok(finalLevel.board.every((row) => row.length === 7));
  assert.ok(isRaccoonGameState(finalLevel, 100));

  const hint = getRaccoonHint(firstLevel, 1);
  assert.ok(hint);
  assert.equal(
    applyRaccoonMove(firstLevel, 1, hint[0], hint[1]).accepted,
    true,
  );
});

test("invalid swaps do not consume a move or modify the board", () => {
  const state = createRaccoonGameState(1);
  const invalid = applyRaccoonMove(
    state,
    1,
    { row: 0, column: 0 },
    { row: 0, column: 6 },
  );

  assert.equal(invalid.accepted, false);
  assert.equal(invalid.state, state);
  assert.equal(invalid.state.movesLeft, state.movesLeft);
});

test("a hammer removes a valid target without spending a move", () => {
  const state = createRaccoonGameState(1);
  const targetRow = state.board.findIndex((row) =>
    row.some((cell) => cell !== null),
  );
  const targetColumn =
    state.board[targetRow]?.findIndex((cell) => cell !== null) ?? -1;
  const result = applyRaccoonBooster(state, 1, "hammer", {
    row: targetRow,
    column: targetColumn,
  });

  assert.equal(result.accepted, true);
  assert.equal(result.state.movesLeft, state.movesLeft);
  assert.equal(result.state.boosters.hammer, state.boosters.hammer - 1);
});

test("the final-boss magnet requires a charge and cannot target off-board cells", () => {
  const state = createRaccoonGameState(100);
  assert.equal(applyRaccoonMagnet(state, 100).accepted, false);

  const chargedState = {
    ...state,
    collected: { ...state.collected, cpu: MAGNET_CHARGE_SIZE },
  };
  assert.equal(applyRaccoonMagnet(chargedState, 100).accepted, true);

  const offBoard = applyRaccoonMove(
    state,
    100,
    { row: 0, column: 0 },
    { row: 0, column: 1 },
  );
  assert.equal(offBoard.accepted, false);
});

test("stored game snapshots reject mismatched board dimensions", () => {
  const state = createRaccoonGameState(1);
  const invalid = {
    ...state,
    board: state.board.map((row, index) =>
      index === 0 ? [...row, null] : row,
    ),
  };

  assert.equal(isRaccoonGameState(invalid, 1), false);
});
