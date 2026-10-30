import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test, { type TestContext } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { getSeasonCalendar } from "../src/features/seasonal/seasonal-calendar.js";
import { createSeasonalThemeRouter } from "../src/features/seasonal/seasonal-theme.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const sessionToken = "S".repeat(48);

const createTestApp = async (
  t: TestContext,
  now: () => Date,
  role: "ADMIN" | "CUSTOMER" = "ADMIN",
) => {
  let settingValue: unknown = null;
  let writeCount = 0;
  const database = {
    appSetting: {
      findUnique: async () =>
        settingValue === null
          ? null
          : { key: "seasonal_theme", value: settingValue },
      upsert: async ({
        create,
        update,
      }: {
        readonly create: { readonly value: unknown };
        readonly update: { readonly value: unknown };
      }) => {
        settingValue = update.value ?? create.value;
        writeCount += 1;
        return { key: "seasonal_theme", value: settingValue };
      },
    },
    session: {
      findUnique: async ({
        where,
      }: {
        readonly where: { readonly tokenHash: string };
      }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? {
              expiresAt: new Date(Date.now() + 60_000),
              user: {
                id: "11111111-1111-4111-8111-111111111111",
                email: "seasonal@example.test",
                displayName: "Тестовый пользователь",
                phoneNumber: null,
                avatarObjectId: null,
                role,
                active: true,
                mustChangePassword: false,
              },
            }
          : null,
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createSeasonalThemeRouter(database as unknown as DatabaseClient, now),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return {
    endpoint: `http://127.0.0.1:${address.port}/api/seasonal-theme`,
    getWriteCount: () => writeCount,
  };
};

test("the Moscow calendar changes seasons at the first day of each month", () => {
  const cases = [
    ["2026-02-28T20:59:59.999Z", "WINTER", "2025-12-01"],
    ["2026-02-28T21:00:00.000Z", "SPRING", "2026-03-01"],
    ["2026-05-31T20:59:59.999Z", "SPRING", "2026-03-01"],
    ["2026-05-31T21:00:00.000Z", "SUMMER", "2026-06-01"],
    ["2026-08-31T20:59:59.999Z", "SUMMER", "2026-06-01"],
    ["2026-08-31T21:00:00.000Z", "AUTUMN", "2026-09-01"],
    ["2026-11-30T20:59:59.999Z", "AUTUMN", "2026-09-01"],
    ["2026-11-30T21:00:00.000Z", "WINTER", "2026-12-01"],
  ] as const;

  for (const [instant, season, startsOn] of cases) {
    const calendar = getSeasonCalendar(new Date(instant));
    assert.equal(calendar.calendarSeason, season, instant);
    assert.equal(calendar.seasonStartsOn, startsOn, instant);
  }
  assert.deepEqual(getSeasonCalendar(new Date("2026-12-01T00:00:00.000Z")), {
    calendarSeason: "WINTER",
    seasonStartsOn: "2026-12-01",
    nextSeason: "SPRING",
    nextSeasonStartsOn: "2027-03-01",
  });
});

test("the public status defaults to no active theme and reports the next season", async (t) => {
  const { endpoint } = await createTestApp(
    t,
    () => new Date("2026-10-16T09:00:00.000Z"),
  );
  const response = await fetch(endpoint);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    calendarSeason: "AUTUMN",
    seasonStartsOn: "2026-09-01",
    nextSeason: "WINTER",
    nextSeasonStartsOn: "2026-12-01",
    activeSeason: "NONE",
    activatedAt: null,
  });
});

test("only an administrator can change the season", async (t) => {
  const clock = () => new Date("2026-10-16T09:00:00.000Z");
  const anonymous = await createTestApp(t, clock);
  const unauthorized = await fetch(anonymous.endpoint, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ season: "AUTUMN" }),
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(anonymous.getWriteCount(), 0);

  const customer = await createTestApp(t, clock, "CUSTOMER");
  const forbidden = await fetch(customer.endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ season: "AUTUMN" }),
  });
  assert.equal(forbidden.status, 403);
  assert.equal(customer.getWriteCount(), 0);
});

test("an administrator can enable any season regardless of the calendar date", async (t) => {
  const { endpoint, getWriteCount } = await createTestApp(
    t,
    () => new Date("2026-10-16T09:00:00.000Z"),
  );
  const response = await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ season: "WINTER" }),
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).activeSeason, "WINTER");
  assert.equal(getWriteCount(), 1);
});

test("an administrator can switch seasons and disable the active theme", async (t) => {
  let instant = new Date("2026-10-16T09:00:00.000Z");
  const { endpoint, getWriteCount } = await createTestApp(t, () => instant);
  const request = (season: string) =>
    fetch(endpoint, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${sessionToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ season }),
    });

  const activated = await request("AUTUMN");
  assert.equal(activated.status, 200);
  assert.equal((await activated.json()).activeSeason, "AUTUMN");
  assert.equal(getWriteCount(), 1);

  const disabled = await request("NONE");
  assert.equal(disabled.status, 200);
  assert.equal((await disabled.json()).activeSeason, "NONE");
  assert.equal(getWriteCount(), 2);

  instant = new Date("2026-11-30T21:00:00.000Z");
  const winter = await request("WINTER");
  assert.equal(winter.status, 200);
  assert.equal((await winter.json()).activeSeason, "WINTER");
  assert.equal(getWriteCount(), 3);
});

test("a manually selected theme remains active after the calendar season changes", async (t) => {
  let instant = new Date("2026-10-16T09:00:00.000Z");
  const { endpoint } = await createTestApp(t, () => instant);
  await fetch(endpoint, {
    method: "PUT",
    headers: {
      authorization: `Bearer ${sessionToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ season: "AUTUMN" }),
  });

  instant = new Date("2026-11-30T21:00:00.000Z");
  const response = await fetch(endpoint);
  assert.equal((await response.json()).activeSeason, "AUTUMN");
});
