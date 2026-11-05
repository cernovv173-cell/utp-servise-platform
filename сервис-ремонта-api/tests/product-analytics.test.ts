import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import {
  productAnalyticsChannel,
  productAnalyticsDay,
  recordProductAnalytics,
} from "../src/features/analytics/product-analytics.js";
import { createProductAnalyticsRouter } from "../src/features/analytics/product-analytics.routes.js";
import {
  type AuthenticatedUser,
  hashSessionToken,
} from "../src/features/auth/auth.middleware.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

test("analytics stores only an atomic daily event count", async () => {
  let upsertInput: unknown;
  const database = {
    productAnalyticsDailyMetric: {
      upsert: async (input: unknown) => {
        upsertInput = input;
        return {};
      },
    },
  };

  await recordProductAnalytics(
    database as unknown as DatabaseClient,
    "LOGIN",
    "ANDROID",
    new Date("2026-11-05T23:30:00.000Z"),
  );

  assert.deepEqual(upsertInput, {
    where: {
      day_metric_channel: {
        day: new Date("2026-11-06T00:00:00.000Z"),
        metric: "LOGIN",
        channel: "ANDROID",
      },
    },
    create: {
      day: new Date("2026-11-06T00:00:00.000Z"),
      metric: "LOGIN",
      channel: "ANDROID",
      count: 1,
    },
    update: { count: { increment: 1 } },
  });
});

test("analytics classifies browser, Android, and MAX registration sources", () => {
  const headers: Record<string, string> = {};
  const request = { header: (name: string) => headers[name.toLowerCase()] };

  assert.equal(productAnalyticsChannel(request), "OTHER");
  headers["user-agent"] = "Dalvik/2.1.0 (Linux; U; Android 15)";
  assert.equal(productAnalyticsChannel(request), "ANDROID");
  headers.origin = "https://service.example";
  assert.equal(productAnalyticsChannel(request), "WEB");
  assert.equal(
    productAnalyticsDay(new Date("2026-11-05T23:30:00.000Z")).toISOString(),
    "2026-11-06T00:00:00.000Z",
  );
});

test("analytics report is admin-only and returns daily totals by source", async (t) => {
  const adminToken = "A".repeat(48);
  const customerToken = "C".repeat(48);
  const admin: AuthenticatedUser = {
    id: "11111111-1111-4111-8111-111111111111",
    email: "admin@example.test",
    displayName: "Administrator",
    phoneNumber: null,
    gender: null,
    birthDate: null,
    telegramChatId: null,
    maxUserId: null,
    avatarObjectId: null,
    role: "ADMIN",
    salaryRatePercent: 75,
    active: true,
    mustChangePassword: false,
  };
  const customer = {
    ...admin,
    id: "22222222-2222-4222-8222-222222222222",
    role: "CUSTOMER" as const,
  };
  const today = productAnalyticsDay();
  const rows = [
    {
      day: today,
      metric: "LOGIN" as const,
      channel: "WEB" as const,
      count: 12,
    },
    {
      day: today,
      metric: "REGISTRATION" as const,
      channel: "ANDROID" as const,
      count: 3,
    },
    {
      day: today,
      metric: "APP_DOWNLOAD" as const,
      channel: "WEB" as const,
      count: 5,
    },
    {
      day: today,
      metric: "REGISTRATION" as const,
      channel: "MAX" as const,
      count: 2,
    },
  ];
  let query: unknown;
  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) => {
        if (where.tokenHash === hashSessionToken(adminToken)) {
          return { expiresAt: new Date(Date.now() + 60_000), user: admin };
        }
        if (where.tokenHash === hashSessionToken(customerToken)) {
          return { expiresAt: new Date(Date.now() + 60_000), user: customer };
        }
        return null;
      },
    },
    productAnalyticsDailyMetric: {
      findMany: async (input: unknown) => {
        query = input;
        return rows;
      },
    },
  };
  const app = express();
  app.use(express.json());
  app.use(
    "/api",
    createProductAnalyticsRouter(database as unknown as DatabaseClient),
  );
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}/api/admin/analytics?days=7`;

  const forbidden = await fetch(url, {
    headers: { authorization: `Bearer ${customerToken}` },
  });
  assert.equal(forbidden.status, 403);

  const response = await fetch(url, {
    headers: { authorization: `Bearer ${adminToken}` },
  });
  assert.equal(response.status, 200);
  const report = await response.json();
  assert.equal(report.range.days, 7);
  assert.deepEqual(report.totals, {
    LOGIN: 12,
    REGISTRATION: 5,
    APP_DOWNLOAD: 5,
  });
  assert.equal(report.channels.WEB.LOGIN, 12);
  assert.equal(report.channels.ANDROID.REGISTRATION, 3);
  assert.equal(report.channels.MAX.REGISTRATION, 2);
  assert.equal(report.daily.length, 7);
  assert.deepEqual(query, {
    where: {
      day: { gte: new Date(today.getTime() - 6 * 86_400_000), lte: today },
    },
    orderBy: { day: "asc" },
  });
});
