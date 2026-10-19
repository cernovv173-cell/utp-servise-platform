import express from "express";
import assert from "node:assert/strict";
import { once } from "node:events";
import { test } from "node:test";

import { hashSessionToken } from "../src/features/auth/auth.middleware.js";
import {
  isMaxWebhookSecretValid,
  maxWebhookSecret,
} from "../src/features/max/max-bot.js";
import { createMaxRouter } from "../src/features/max/max.routes.js";
import type { DatabaseClient } from "../src/lib/database/database.js";
import { errorHandler } from "../src/lib/http/error-handler.js";
import { mockMaxApiRequests } from "./helpers/mock-max-api.js";

const restoreEnvironment = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

test("MAX deep-link confirmation is one-time and updates only MAX account state", async (t) => {
  const previousEnvironment = {
    token: process.env.MAX_BOT_TOKEN,
    integrationSecret: process.env.MAX_WEBHOOK_SECRET,
    signingSecret: process.env.MAX_WEBHOOK_SIGNING_SECRET,
    webhookUrl: process.env.MAX_WEBHOOK_URL,
  };
  const botToken = "test-token-only-not-a-live-credential";
  const webhookSecret = "test-webhook-secret-only-not-a-live-secret";
  process.env.MAX_BOT_TOKEN = botToken;
  process.env.MAX_WEBHOOK_SIGNING_SECRET = webhookSecret;
  delete process.env.MAX_WEBHOOK_SECRET;
  process.env.MAX_WEBHOOK_URL = "https://api.example.test/api/max/webhook";
  const maxApiMock = mockMaxApiRequests((request) =>
    request.url.endsWith("/me")
      ? { body: { username: "service_bot" } }
      : { body: { message: {} } },
  );

  const customerId = "22222222-2222-4222-8222-222222222222";
  const sessionToken = "S".repeat(48);
  const linkTokenId = "33333333-3333-4333-8333-333333333333";
  let storedTokenHash: string | null = null;
  let consumed = false;
  let linkedMaxUserId: string | null = null;
  let accountLinkWrites = 0;

  const transaction = {
    maxLinkToken: {
      updateMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === linkTokenId) consumed = true;
        return { count: 1 };
      },
      deleteMany: async () => ({ count: 0 }),
      create: async ({
        data,
      }: {
        data: { tokenHash: string; userId: string };
      }) => {
        storedTokenHash = data.tokenHash;
        return { ...data, id: linkTokenId };
      },
      findUnique: async () => ({ userId: customerId }),
    },
    user: {
      findUnique: async () => (linkedMaxUserId ? { id: customerId } : null),
      update: async ({ data }: { data: { maxUserId: string } }) => {
        linkedMaxUserId = data.maxUserId;
        accountLinkWrites += 1;
        return { id: customerId };
      },
    },
    $queryRaw: async (_query: TemplateStringsArray, hash: string) =>
      !consumed && hash === storedTokenHash ? [{ id: linkTokenId }] : [],
  };

  const database = {
    session: {
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        where.tokenHash === hashSessionToken(sessionToken)
          ? {
              expiresAt: new Date(Date.now() + 60_000),
              user: {
                id: customerId,
                email: "customer@example.test",
                displayName: "Клиент",
                phoneNumber: null,
                gender: null,
                birthDate: null,
                telegramChatId: null,
                maxUserId: linkedMaxUserId,
                avatarObjectId: null,
                role: "CUSTOMER",
                salaryRatePercent: 75,
                active: true,
                mustChangePassword: false,
              },
            }
          : null,
    },
    $transaction: async (operation: unknown) =>
      typeof operation === "function"
        ? operation(transaction)
        : Promise.all(operation as Promise<unknown>[]),
  };

  try {
    assert.equal(maxWebhookSecret(), webhookSecret);
    const app = express();
    app.use(express.json());
    app.use("/api", createMaxRouter(database as unknown as DatabaseClient));
    app.use(errorHandler);
    const server = app.listen(0);
    await once(server, "listening");
    t.after(() => server.close());

    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const baseUrl = `http://127.0.0.1:${address.port}/api`;
    const headers = { authorization: `Bearer ${sessionToken}` };

    const statusBefore = await fetch(`${baseUrl}/auth/max/status`, { headers });
    assert.deepEqual(await statusBefore.json(), {
      available: true,
      connected: false,
    });

    const linkResponse = await fetch(`${baseUrl}/auth/max/link`, {
      method: "POST",
      headers,
    });
    assert.equal(linkResponse.status, 200);
    const link = (await linkResponse.json()) as { url: string };
    const deepLink = new URL(link.url);
    assert.equal(deepLink.hostname, "max.ru");
    assert.equal(deepLink.pathname, "/service_bot");
    const payload = deepLink.searchParams.get("start");
    assert.ok(payload);

    const webhookHeaders = {
      "content-type": "application/json",
      "x-max-bot-api-secret": webhookSecret,
    };
    assert.equal(
      isMaxWebhookSecretValid(webhookHeaders["x-max-bot-api-secret"]),
      true,
    );
    const webhookBody = JSON.stringify({
      update_type: "bot_started",
      chat_id: 987654321,
      user: { user_id: 987654321 },
      payload,
    });
    const firstConfirmation = await fetch(`${baseUrl}/max/webhook`, {
      method: "POST",
      headers: webhookHeaders,
      body: webhookBody,
    });
    assert.equal(firstConfirmation.status, 200);
    assert.equal(linkedMaxUserId, "987654321");
    assert.equal(accountLinkWrites, 1);
    assert.equal(
      maxApiMock.requests[0]?.url,
      "https://platform-api2.max.ru/me",
    );
    assert.equal(maxApiMock.requests[0]?.authorization, botToken);
    assert.equal(maxApiMock.requests[1]?.method, "POST");

    const repeatedConfirmation = await fetch(`${baseUrl}/max/webhook`, {
      method: "POST",
      headers: webhookHeaders,
      body: webhookBody,
    });
    assert.equal(repeatedConfirmation.status, 200);
    assert.equal(accountLinkWrites, 1);

    const statusAfter = await fetch(`${baseUrl}/auth/max/status`, { headers });
    assert.deepEqual(await statusAfter.json(), {
      available: true,
      connected: true,
    });
  } finally {
    maxApiMock.restore();
    restoreEnvironment("MAX_BOT_TOKEN", previousEnvironment.token);
    restoreEnvironment(
      "MAX_WEBHOOK_SECRET",
      previousEnvironment.integrationSecret,
    );
    restoreEnvironment(
      "MAX_WEBHOOK_SIGNING_SECRET",
      previousEnvironment.signingSecret,
    );
    restoreEnvironment("MAX_WEBHOOK_URL", previousEnvironment.webhookUrl);
  }
});
