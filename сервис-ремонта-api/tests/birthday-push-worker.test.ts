import assert from "node:assert/strict";
import test from "node:test";

import {
  BIRTHDAY_BONUS_POINTS,
  BIRTHDAY_BONUS_REASON,
  awardBirthdayBonusPoints,
} from "../src/features/notifications/birthday-bonus.js";
import { formatBirthdayGreeting } from "../src/features/notifications/birthday-greeting.js";
import {
  birthdayPushRetryDelayMilliseconds,
  getMoscowBirthdayDate,
  runBirthdayPushWorkerOnce,
} from "../src/features/notifications/birthday-push-worker.js";
import { getMoscowBirthdayDayWindow } from "../src/features/notifications/birthday-time.js";
import type { DatabaseClient } from "../src/lib/database/database.js";

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

test("birthday greeting window is exactly the Moscow calendar day", () => {
  const { startsAt, endsAt } = getMoscowBirthdayDayWindow(
    new Date("2026-10-06T20:59:00.000Z"),
  );
  assert.equal(startsAt.toISOString(), "2026-10-05T21:00:00.000Z");
  assert.equal(endsAt.toISOString(), "2026-10-06T21:00:00.000Z");
  assert.equal(endsAt.getTime() - startsAt.getTime(), 24 * 60 * 60 * 1_000);
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

test("awards 250 points to active birthday customers once per calendar year", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  const database = {
    $executeRaw: async (query: TemplateStringsArray, ...values: unknown[]) => {
      calls.push({ sql: query.join("?"), values });
      return 2;
    },
  } as unknown as DatabaseClient;

  const count = await awardBirthdayBonusPoints(database, 2026, "10-19");

  assert.equal(count, 2);
  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /customer\.role = 'CUSTOMER'/u);
  assert.match(calls[0]!.sql, /customer\.active = TRUE/u);
  assert.match(calls[0]!.sql, /to_char\(customer\.birth_date, 'MM-DD'\)/u);
  assert.match(
    calls[0]!.sql,
    /ON CONFLICT \(user_id, birthday_year\) DO NOTHING/u,
  );
  assert.match(calls[0]!.sql, /loyalty_transactions/u);
  assert.doesNotMatch(calls[0]!.sql, /push_device_tokens/u);
  assert.deepEqual(calls[0]!.values, [
    "10-19",
    2026,
    BIRTHDAY_BONUS_POINTS,
    BIRTHDAY_BONUS_REASON,
  ]);
});

test("birthday worker awards bonuses independently of push-device delivery", async () => {
  const statements: string[] = [];
  const database = {
    $executeRaw: async (query: TemplateStringsArray) => {
      const sql = query.join("?");
      statements.push(sql);
      return sql.includes("birthday_bonus_awards") ? 1 : 0;
    },
    $transaction: async (
      operation: (transaction: {
        $queryRaw: () => Promise<never[]>;
      }) => Promise<never[]>,
    ) => operation({ $queryRaw: async () => [] }),
  } as unknown as DatabaseClient;

  await runBirthdayPushWorkerOnce(
    database,
    new Date("2026-10-18T21:00:00.000Z"),
  );

  assert.match(statements[0]!, /birthday_bonus_awards/u);
  assert.match(statements[1]!, /birthday_push_deliveries/u);
});
