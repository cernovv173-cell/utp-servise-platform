import assert from "node:assert/strict";
import test from "node:test";

import { LoginAttemptThrottle } from "../src/features/auth/login-attempt-throttle.js";

test("slows repeated failures progressively without permanently locking the account", () => {
  let timestamp = 1_000;
  const throttle = new LoginAttemptThrottle(() => timestamp);
  const identifier = "  Client@Example.com  ";

  assert.equal(throttle.delayBeforeAttempt(identifier), 0);
  for (let failure = 0; failure < 3; failure += 1) {
    throttle.recordFailure(identifier);
  }
  assert.equal(throttle.delayBeforeAttempt("client@example.com"), 0);

  throttle.recordFailure(identifier);
  assert.equal(throttle.delayBeforeAttempt(identifier), 250);
  throttle.recordFailure(identifier);
  assert.equal(throttle.delayBeforeAttempt(identifier), 500);
  throttle.recordFailure(identifier);
  assert.equal(throttle.delayBeforeAttempt(identifier), 1_000);

  throttle.clear(identifier);
  assert.equal(throttle.delayBeforeAttempt(identifier), 0);
});

test("expires failures after the observation window and isolates different identifiers", () => {
  let timestamp = 1_000;
  const throttle = new LoginAttemptThrottle(() => timestamp);

  for (let failure = 0; failure < 4; failure += 1) {
    throttle.recordFailure("first@example.com");
  }
  assert.equal(throttle.delayBeforeAttempt("second@example.com"), 0);
  assert.equal(throttle.delayBeforeAttempt("first@example.com"), 250);

  timestamp += 15 * 60 * 1_000;
  assert.equal(throttle.delayBeforeAttempt("first@example.com"), 0);
});
