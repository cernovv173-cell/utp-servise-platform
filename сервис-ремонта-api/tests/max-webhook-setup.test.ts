import assert from "node:assert/strict";
import { test } from "node:test";
import type { Logger } from "pino";

import { setupMaxWebhookIfUnclaimed } from "../src/features/max/max-webhook-setup.js";

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
    webhookUrl: process.env.MAX_WEBHOOK_URL,
    proxyUrl: process.env.AMAZI_PROXY_URL,
    proxyKey: process.env.AMAZI_PROXY_KEY,
  };
  const previousFetch = globalThis.fetch;
  process.env.MAX_BOT_TOKEN = "test-token-only-not-a-live-credential";
  process.env.MAX_WEBHOOK_SECRET = "test-webhook-secret-only-not-live";
  process.env.MAX_WEBHOOK_URL = "https://api.example.test/api/max/webhook";
  delete process.env.AMAZI_PROXY_URL;
  delete process.env.AMAZI_PROXY_KEY;
  const calls: string[] = [];
  globalThis.fetch = async (input, init) => {
    const path = new URL(String(input)).pathname;
    calls.push(`${init?.method ?? "GET"} ${path}`);
    if (path === "/me") {
      return meStatus === 200
        ? Response.json({ username: "service_bot" })
        : Response.json({ error: "unavailable" }, { status: meStatus });
    }
    if (path === "/subscriptions" && init?.method !== "POST") {
      return Response.json({ subscriptions: [] });
    }
    return Response.json({ success: true });
  };

  try {
    await run(calls);
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnvironment("MAX_BOT_TOKEN", previousEnvironment.token);
    restoreEnvironment("MAX_WEBHOOK_SECRET", previousEnvironment.webhookSecret);
    restoreEnvironment("MAX_WEBHOOK_URL", previousEnvironment.webhookUrl);
    restoreEnvironment("AMAZI_PROXY_URL", previousEnvironment.proxyUrl);
    restoreEnvironment("AMAZI_PROXY_KEY", previousEnvironment.proxyKey);
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
