import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getMaxBotProfile,
  isMaxWebhookSecretValid,
  maxWebhookSecret,
  sendMaxMessage,
} from "../src/features/max/max-bot.js";
import {
  formatMaxRepairNotification,
  maxRetryDelayMilliseconds,
} from "../src/features/max/max-notifications.js";

const restoreEnvironment = (name: string, value: string | undefined): void => {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
};

test("formats repair notifications and bounds MAX retry delays", () => {
  assert.equal(
    formatMaxRepairNotification({
      type: "DEVICE_ACCEPTED",
      serviceNumber: "SRV-2026-000001",
      deviceType: "LAPTOP",
    }),
    "Устройство принято\nЗаявка: SRV-2026-000001\nУстройство: Ноутбук",
  );
  assert.equal(
    formatMaxRepairNotification({
      type: "DIAGNOSIS_COMPLETED",
      serviceNumber: "SRV-2026-000001",
      deviceType: "TABLET",
    }).split("\n")[0],
    "Диагностика завершена",
  );
  assert.equal(
    formatMaxRepairNotification({
      type: "READY_FOR_PICKUP",
      serviceNumber: "SRV-2026-000001",
      deviceType: "PHONE",
    }).split("\n")[0],
    "Готово к выдаче",
  );
  assert.equal(maxRetryDelayMilliseconds(1), 10_000);
  assert.equal(maxRetryDelayMilliseconds(2), 20_000);
  assert.equal(maxRetryDelayMilliseconds(20), 6 * 60 * 60 * 1_000);
});

test("derives a valid webhook secret without exposing the MAX token", () => {
  const previous = process.env.MAX_WEBHOOK_SECRET;
  const secret = "test-webhook-secret-only-not-a-live-secret";
  process.env.MAX_WEBHOOK_SECRET = secret;
  try {
    assert.equal(maxWebhookSecret(), secret);
    assert.equal(isMaxWebhookSecretValid(secret), true);
    assert.equal(isMaxWebhookSecretValid("not-the-secret"), false);
    assert.equal(isMaxWebhookSecretValid(undefined), false);
    process.env.MAX_WEBHOOK_SECRET = "invalid webhook secret";
    assert.equal(isMaxWebhookSecretValid(secret), false);
  } finally {
    restoreEnvironment("MAX_WEBHOOK_SECRET", previous);
  }
});

test("uses the official MAX API host and keeps the bot token in the auth header", async () => {
  const previousEnvironment = {
    token: process.env.MAX_BOT_TOKEN,
    proxyUrl: process.env.AMAZI_PROXY_URL,
    proxyKey: process.env.AMAZI_PROXY_KEY,
  };
  const previousFetch = globalThis.fetch;
  const token = "test-token-only-not-a-live-credential";
  process.env.MAX_BOT_TOKEN = token;
  delete process.env.AMAZI_PROXY_URL;
  delete process.env.AMAZI_PROXY_KEY;
  const calls: Array<{ url: string; method?: string; body?: string }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, method: init?.method, body: init?.body?.toString() });
    assert.equal(new Headers(init?.headers).get("authorization"), token);
    if (url.endsWith("/me")) return Response.json({ username: "service_bot" });
    return Response.json({ message: {} });
  };

  try {
    assert.deepEqual(await getMaxBotProfile(), { username: "service_bot" });
    await sendMaxMessage("123456789", "Устройство принято");
    assert.equal(calls[0]?.url, "https://platform-api2.max.ru/me");
    assert.equal(calls[1]?.method, "POST");
    assert.equal(
      calls[1]?.url,
      "https://platform-api2.max.ru/messages?user_id=123456789",
    );
    assert.equal(
      calls[1]?.body,
      JSON.stringify({ text: "Устройство принято" }),
    );
    assert.ok(calls.every((call) => !call.url.includes(token)));
  } finally {
    globalThis.fetch = previousFetch;
    restoreEnvironment("MAX_BOT_TOKEN", previousEnvironment.token);
    restoreEnvironment("AMAZI_PROXY_URL", previousEnvironment.proxyUrl);
    restoreEnvironment("AMAZI_PROXY_KEY", previousEnvironment.proxyKey);
  }
});
