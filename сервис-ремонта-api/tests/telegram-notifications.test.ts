import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  TelegramApiError,
  getTelegramBotProfile,
  isTelegramWebhookSecretValid,
  sendTelegramMessage,
  telegramWebhookSecret,
} from "../src/features/telegram/telegram-bot.js";
import {
  formatTelegramRepairNotification,
  telegramRetryDelayMilliseconds,
} from "../src/features/telegram/telegram-notifications.js";

test("formats the requested repair milestones without exposing customer details", () => {
  assert.equal(
    formatTelegramRepairNotification({
      type: "DEVICE_ACCEPTED",
      serviceNumber: "SRV-2026-000001",
      deviceType: "LAPTOP",
    }),
    "Устройство принято\nЗаявка: SRV-2026-000001\nУстройство: Ноутбук",
  );
  assert.equal(
    formatTelegramRepairNotification({
      type: "DIAGNOSIS_COMPLETED",
      serviceNumber: "SRV-2026-000001",
      deviceType: "TABLET",
    }).split("\n")[0],
    "Диагностика завершена",
  );
  assert.equal(
    formatTelegramRepairNotification({
      type: "READY_FOR_PICKUP",
      serviceNumber: "SRV-2026-000001",
      deviceType: "PHONE",
    }).split("\n")[0],
    "Готово к выдаче",
  );
});

test("backs off Telegram delivery retries with a bounded delay", () => {
  assert.equal(telegramRetryDelayMilliseconds(1), 10_000);
  assert.equal(telegramRetryDelayMilliseconds(2), 20_000);
  assert.equal(telegramRetryDelayMilliseconds(20), 6 * 60 * 60 * 1_000);
});

test("derives and validates the webhook secret without exposing the bot token", () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  process.env.TELEGRAM_BOT_TOKEN = "test-token-only-not-a-live-credential";
  try {
    const expected = createHmac("sha256", process.env.TELEGRAM_BOT_TOKEN)
      .update("utp-servise-telegram-webhook-v1")
      .digest("base64url");
    assert.equal(telegramWebhookSecret(), expected);
    assert.equal(isTelegramWebhookSecretValid(expected), true);
    assert.equal(isTelegramWebhookSecretValid("not-the-secret"), false);
    assert.equal(isTelegramWebhookSecretValid(undefined), false);
  } finally {
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
  }
});

test("uses the managed outbound proxy without exposing its credentials", async () => {
  const originalEnvironment = {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN,
    proxyUrl: process.env.AMAZI_PROXY_URL,
    proxyKey: process.env.AMAZI_PROXY_KEY,
  };
  const originalFetch = globalThis.fetch;
  process.env.TELEGRAM_BOT_TOKEN = "test-token-only-not-a-live-credential";
  process.env.AMAZI_PROXY_URL = "https://proxy.test.invalid";
  process.env.AMAZI_PROXY_KEY = "test-proxy-key";
  let proxyCalls = 0;
  globalThis.fetch = async (input, init) => {
    proxyCalls += 1;
    assert.equal(String(input), "https://proxy.test.invalid");
    assert.equal(
      new Headers(init?.headers).get("authorization"),
      "Bearer test-proxy-key",
    );
    const forwarded = JSON.parse(String(init?.body)) as {
      readonly url: string;
      readonly method: string;
      readonly body: string;
    };
    assert.equal(forwarded.method, "POST");
    assert.equal(new URL(forwarded.url).hostname, "api.telegram.org");
    return Response.json({ ok: true, result: { username: "test_bot" } });
  };

  try {
    const bot = await getTelegramBotProfile();
    assert.equal(bot.username, "test_bot");
    assert.equal(proxyCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalEnvironment.telegramToken === undefined)
      delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalEnvironment.telegramToken;
    if (originalEnvironment.proxyUrl === undefined)
      delete process.env.AMAZI_PROXY_URL;
    else process.env.AMAZI_PROXY_URL = originalEnvironment.proxyUrl;
    if (originalEnvironment.proxyKey === undefined)
      delete process.env.AMAZI_PROXY_KEY;
    else process.env.AMAZI_PROXY_KEY = originalEnvironment.proxyKey;
  }
});

test("does not include a Bot API credential in errors", async () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalProxyUrl = process.env.AMAZI_PROXY_URL;
  const originalProxyKey = process.env.AMAZI_PROXY_KEY;
  const originalFetch = globalThis.fetch;
  const fakeToken = "test-token-only-not-a-live-credential";
  process.env.TELEGRAM_BOT_TOKEN = fakeToken;
  delete process.env.AMAZI_PROXY_URL;
  delete process.env.AMAZI_PROXY_KEY;
  globalThis.fetch = async () =>
    Response.json(
      { ok: false, error_code: 401, description: "Unauthorized" },
      { status: 401 },
    );

  try {
    await assert.rejects(
      sendTelegramMessage("12345", "test"),
      (error: unknown) =>
        error instanceof TelegramApiError &&
        error.errorCode === 401 &&
        !error.message.includes(fakeToken),
    );
  } finally {
    globalThis.fetch = originalFetch;
    if (originalToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN;
    else process.env.TELEGRAM_BOT_TOKEN = originalToken;
    if (originalProxyUrl === undefined) delete process.env.AMAZI_PROXY_URL;
    else process.env.AMAZI_PROXY_URL = originalProxyUrl;
    if (originalProxyKey === undefined) delete process.env.AMAZI_PROXY_KEY;
    else process.env.AMAZI_PROXY_KEY = originalProxyKey;
  }
});
