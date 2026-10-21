import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getCurrentTechnologyFact,
  technologyFactRotationIntervalMilliseconds,
} from "../src/features/news/technology-facts.js";

test("technology facts change at two-hour UTC boundaries", () => {
  const beforeBoundary = getCurrentTechnologyFact(
    new Date("2026-10-21T13:59:59.999Z"),
  );
  const atBoundary = getCurrentTechnologyFact(
    new Date("2026-10-21T14:00:00.000Z"),
  );

  assert.notEqual(beforeBoundary.id, atBoundary.id);
  assert.equal(beforeBoundary.nextUpdateAt, "2026-10-21T14:00:00.000Z");
  assert.equal(atBoundary.updatedAt, "2026-10-21T14:00:00.000Z");
  assert.equal(
    Date.parse(atBoundary.nextUpdateAt) - Date.parse(atBoundary.updatedAt),
    technologyFactRotationIntervalMilliseconds,
  );
});

test("the same fact is shared throughout each interval and repeats daily", () => {
  const first = getCurrentTechnologyFact(new Date("2026-10-21T14:00:00.000Z"));
  const laterInInterval = getCurrentTechnologyFact(
    new Date("2026-10-21T15:59:59.999Z"),
  );
  const nextDay = getCurrentTechnologyFact(
    new Date("2026-10-22T14:00:00.000Z"),
  );

  assert.equal(laterInInterval.id, first.id);
  assert.equal(nextDay.id, first.id);
  assert.ok(first.sourceUrl.startsWith("https://"));
});
