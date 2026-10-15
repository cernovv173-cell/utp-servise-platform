import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import { createMatch3PlayRouter } from "../src/features/game/match3/match3-play.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";

const customerToken = "R".repeat(48);

test("restarting a completed current level preserves campaign progress", async (t) => {
  const customer = {
    id: "customer-1",
    email: "customer@test.invalid",
    displayName: "Customer",
    phoneNumber: null,
    gender: null,
    birthDate: null,
    telegramChatId: null,
    maxUserId: null,
    avatarObjectId: null,
    role: "CUSTOMER" as const,
    salaryRatePercent: 75,
    active: true,
    mustChangePassword: false,
  };
  const level = {
    id: "2dced950-1c63-4ab1-b211-e04ce8e39e81",
    number: 7,
    title: "Level 7",
    targetPart: "processor",
    targetCount: 12,
    moveLimit: 20,
    isActive: true,
  };
  const previous = {
    id: "dd8f2595-00c3-4710-b109-c9e2027851b4",
    customerId: customer.id,
    levelId: level.id,
    level,
    board: [],
    targetCollected: 12,
    movesUsed: 9,
    status: "COMPLETE",
    createdAt: new Date("2026-10-15T11:00:00Z"),
    updatedAt: new Date("2026-10-15T11:05:00Z"),
    completedAt: new Date("2026-10-15T11:05:00Z"),
  };
  let createdSession: Record<string, unknown> | null = null;
  const database = {
    session: {
      findUnique: async () => ({
        user: customer,
        expiresAt: new Date(Date.now() + 60_000),
      }),
    },
    match3GameSession: {
      findFirst: async () => previous,
    },
    $transaction: async (work: (transaction: unknown) => unknown) =>
      work({
        match3GameSession: {
          updateMany: async ({
            where,
            data,
          }: {
            where: { id: string; status: string };
            data: { status: string };
          }) => {
            if (where.id !== previous.id || where.status !== previous.status) {
              return { count: 0 };
            }
            previous.status = data.status;
            return { count: 1 };
          },
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdSession = data;
            return {
              ...previous,
              ...data,
              id: "35da661e-dae9-44f4-b6d6-9049dc66860d",
              targetCollected: 0,
              movesUsed: 0,
              status: "ACTIVE",
              completedAt: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              level,
            };
          },
        },
      }),
  } as unknown as DatabaseClient;

  const app = express();
  app.use(express.json());
  app.use("/api", createMatch3PlayRouter(database));
  app.use(errorHandler);
  const server = app.listen(0);
  await once(server, "listening");
  t.after(() => server.close());

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/game/match3/restart`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${customerToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ sessionId: previous.id }),
    },
  );

  assert.equal(response.status, 200);
  const payload = (await response.json()) as {
    session: { status: string; level: { number: number } };
  };
  assert.equal(payload.session.status, "ACTIVE");
  assert.equal(payload.session.level.number, level.number);
  assert.equal(previous.status, "REPLAYED");
  assert.equal(createdSession?.levelId, level.id);
  assert.equal(createdSession?.customerId, customer.id);
});
