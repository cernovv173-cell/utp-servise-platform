import assert from "node:assert/strict";
import test from "node:test";

import { getMoscowWeekStart } from "../src/features/games/game-week.js";

test("game reward week starts Monday at midnight Moscow time", () => {
  assert.equal(
    getMoscowWeekStart(new Date("2026-10-13T18:00:00.000Z")).toISOString(),
    "2026-10-11T21:00:00.000Z",
  );
});

test("Moscow week boundary advances at local Monday midnight", () => {
  assert.equal(
    getMoscowWeekStart(new Date("2026-10-18T20:59:59.999Z")).toISOString(),
    "2026-10-11T21:00:00.000Z",
  );
  assert.equal(
    getMoscowWeekStart(new Date("2026-10-18T21:00:00.000Z")).toISOString(),
    "2026-10-18T21:00:00.000Z",
  );
});
