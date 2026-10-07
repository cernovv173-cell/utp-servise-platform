import assert from "node:assert/strict";
import test from "node:test";

import {
  birthdayPushRetryDelayMilliseconds,
  getMoscowBirthdayDate,
} from "../src/features/notifications/birthday-push-worker.js";
import { formatBirthdayGreeting } from "../src/features/notifications/push-notifications.js";

test("birthday dates use the Moscow calendar day around UTC midnight", () => {
  assert.deepEqual(
    getMoscowBirthdayDate(new Date("2026-10-06T20:59:00.000Z")),
    { year: 2026, monthDay: "10-06" },
  );
  assert.deepEqual(
    getMoscowBirthdayDate(new Date("2026-10-06T21:00:00.000Z")),
    { year: 2026, monthDay: "10-07" },
  );
});

test("birthday push retry delay is exponential and capped at one hour", () => {
  assert.equal(birthdayPushRetryDelayMilliseconds(1), 10_000);
  assert.equal(birthdayPushRetryDelayMilliseconds(3), 40_000);
  assert.equal(birthdayPushRetryDelayMilliseconds(10), 60 * 60 * 1_000);
});

test("birthday greeting personalizes the user's name and gendered salutation", () => {
  assert.match(formatBirthdayGreeting("Анна", "FEMALE"), /^Уважаемая Анна,/u);
  assert.match(formatBirthdayGreeting("Иван", "MALE"), /^Уважаемый Иван,/u);
  assert.match(formatBirthdayGreeting("Алекс", null), /^Здравствуйте, Алекс,/u);
  assert.match(formatBirthdayGreeting("Иван", "MALE"), /ваш ЕНОТ\.$/u);
});
