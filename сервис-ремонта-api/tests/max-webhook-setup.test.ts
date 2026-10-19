import assert from "node:assert/strict";
import { test } from "node:test";
import type { Logger } from "pino";

import { setupMaxWebhookIfUnclaimed } from "../src/features/max/max-webhook-setup.js";
import { mockMaxApiRequests } from "./helpers/mock-max-api.js";

const restoreEnvironment = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

const withMaxEnvironment = async (
  run: (calls: string[]) => Promise<void>,
  meStatus = 200,
): Promise<void> => {
  const previousEnvironment = {
    token: process.env.MAX_BOT_TOKEN,
    webhookSecret: process.env.MAX_WEBHOOK_SECRET,
    signingSecret: process.env.MAX_WEBHOOK_SIGNING_SECRET,
    webhookUrl: process.env.MAX_WEBHOOK_URL,
  };
  process.env.MAX_BOT_TOKEN = "test-token-only-not-a-live-credential";
  process.env.MAX_WEBHOOK_SIGNING_SECRET = "test-signing-secret-only-not-live";
  delete process.env.MAX_WEBHOOK_SECRET;
  process.env.MAX_WEBHOOK_URL = "https://api.example.test/api/max/webhook";
  const calls: string[] = [];
  const mock = mockMaxApiRequests((request) => {
    const path = new URL(request.url).pathname;
    calls.push(`${request.method} ${path}`);
    if (path === "/me") {
      return meStatus === 200
        ? { body: { username: "service_bot" } }
        : { status: meStatus, body: { error: "unavailable" } };
    }
    if (path === "/subscriptions" && request.method !== "POST") {
      return { body: { subscriptions: [] } };
    }
    return { body: { success: true } };
  });

  try {
    await run(calls);
  } finally {
    mock.restore();
    restoreEnvironment("MAX_BOT_TOKEN", previousEnvironment.token);
    restoreEnvironment("MAX_WEBHOOK_SECRET", previousEnvironment.webhookSecret);
    restoreEnvironment(
      "MAX_WEBHOOK_SIGNING_SECRET",
      previousEnvironment.signingSecret,
    );
    restoreEnvironment("MAX_WEBHOOK_URL", previousEnvironment.webhookUrl);
  }
};

const logger = {
  info: () => undefined,
  warn: () => undefined,
} as unknown as Logger;

test("verifies the MAX bot before registering its webhook", async () => {
  await withMaxEnvironment(async (calls) => {
    await setupMaxWebhookIfUnclaimed(logger);
    assert.deepEqual(calls, [
      "GET /me",
      "GET /subscriptions",
      "POST /subscriptions",
    ]);
  });
});

test("does not inspect or change webhook subscriptions when bot verification fails", async () => {
  await withMaxEnvironment(async (calls) => {
    await setupMaxWebhookIfUnclaimed(logger);
    assert.deepEqual(calls, ["GET /me"]);
  }, 502);
});
