import assert from "node:assert/strict";
import test from "node:test";

import { newsPushRetryDelayMilliseconds } from "../src/features/news/news-push-worker.js";

test("news push retry delay increases exponentially and is capped at one hour", () => {
  assert.equal(newsPushRetryDelayMilliseconds(1), 10_000);
  assert.equal(newsPushRetryDelayMilliseconds(2), 20_000);
  assert.equal(newsPushRetryDelayMilliseconds(3), 40_000);
  assert.equal(newsPushRetryDelayMilliseconds(10), 60 * 60 * 1_000);
  assert.equal(newsPushRetryDelayMilliseconds(20), 60 * 60 * 1_000);
});
