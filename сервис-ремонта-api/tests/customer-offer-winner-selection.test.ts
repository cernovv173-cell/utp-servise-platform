import assert from "node:assert/strict";
import { test } from "node:test";

import { selectRandomWinners } from "../src/features/customer-offers/winner-selection.js";

test("winner selection returns distinct entries using the supplied random source", () => {
  const selected = selectRandomWinners(
    ["one", "two", "three", "four"],
    3,
    (maxExclusive) => maxExclusive - 1,
  );

  assert.equal(selected.length, 3);
  assert.equal(new Set(selected).size, 3);
  assert.deepEqual(selected, ["four", "one", "two"]);
});

test("winner selection rejects a count outside the entry range", () => {
  assert.throws(() => selectRandomWinners(["one"], 2), RangeError);
  assert.throws(() => selectRandomWinners(["one"], -1), RangeError);
});
