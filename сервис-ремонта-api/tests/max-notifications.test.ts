import assert from "node:assert/strict";
import { test } from "node:test";

import {
  getMaxBotProfile,
  hasMaxWebhookSecret,
  isMaxWebhookSecretValid,
  maxWebhookSecret,
  sendMaxFileMessage,
  sendMaxMessage,
  uploadMaxFile,
} from "../src/features/max/max-bot.js";
import {
  formatMaxRepairNotification,
  maxRetryDelayMilliseconds,
} from "../src/features/max/max-notifications.js";
import { mockMaxApiRequests } from "./helpers/mock-max-api.js";

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
      type: "TECHNICIAN_REPAIR_COMPLETED",
      serviceNumber: "SRV-2026-000001",
      deviceType: "COMPUTER",
    }),
    "Работы завершены\nЗаявка: SRV-2026-000001\nУстройство: Компьютер\nМастер сообщил о завершении работ по заявке.",
  );
  assert.equal(
    formatMaxRepairNotification({
      type: "REPAIR_COMPLETED",
      serviceNumber: "SRV-2026-000001",
      deviceType: "LAPTOP",
    }).split("\n")[0],
    "Ремонт завершён",
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

test("prefers the API-owned webhook secret and validates its fallback", () => {
  const previous = {
    integrationSecret: process.env.MAX_WEBHOOK_SECRET,
    signingSecret: process.env.MAX_WEBHOOK_SIGNING_SECRET,
  };
  const signingSecret = "test-signing-secret-only-not-a-live-secret";
  const integrationSecret = "test-integration-secret-only-not-live";
  process.env.MAX_WEBHOOK_SIGNING_SECRET = signingSecret;
  process.env.MAX_WEBHOOK_SECRET = integrationSecret;
  try {
    assert.equal(hasMaxWebhookSecret(), true);
    assert.equal(maxWebhookSecret(), signingSecret);
    assert.equal(isMaxWebhookSecretValid(signingSecret), true);
    assert.equal(isMaxWebhookSecretValid("not-the-secret"), false);
    assert.equal(isMaxWebhookSecretValid(undefined), false);
    delete process.env.MAX_WEBHOOK_SIGNING_SECRET;
    assert.equal(maxWebhookSecret(), integrationSecret);
    process.env.MAX_WEBHOOK_SECRET = "invalid webhook secret";
    assert.equal(hasMaxWebhookSecret(), false);
    assert.equal(isMaxWebhookSecretValid(signingSecret), false);
  } finally {
    restoreEnvironment("MAX_WEBHOOK_SECRET", previous.integrationSecret);
    restoreEnvironment("MAX_WEBHOOK_SIGNING_SECRET", previous.signingSecret);
  }
});

test("uses the official MAX API host and keeps the bot token in the auth header", async () => {
  const previousEnvironment = {
    token: process.env.MAX_BOT_TOKEN,
    integrationSecret: process.env.MAX_WEBHOOK_SECRET,
    signingSecret: process.env.MAX_WEBHOOK_SIGNING_SECRET,
  };
  const token = "test-token-only-not-a-live-credential";
  process.env.MAX_BOT_TOKEN = token;
  process.env.MAX_WEBHOOK_SECRET = "integration-secret-only-for-test";
  delete process.env.MAX_WEBHOOK_SIGNING_SECRET;
  const mock = mockMaxApiRequests((request) =>
    request.url.endsWith("/me")
      ? { body: { username: "service_bot" } }
      : { body: { message: {} } },
  );

  try {
    assert.deepEqual(await getMaxBotProfile(), { username: "service_bot" });
    await sendMaxMessage("123456789", "Устройство принято");
    assert.equal(mock.requests[0]?.url, "https://platform-api2.max.ru/me");
    assert.equal(mock.requests[0]?.authorization, token);
    assert.equal(mock.requests[1]?.method, "POST");
    assert.equal(
      mock.requests[1]?.url,
      "https://platform-api2.max.ru/messages?user_id=123456789",
    );
    assert.equal(
      mock.requests[1]?.body,
      JSON.stringify({ text: "Устройство принято" }),
    );
    assert.ok(mock.requests.every((request) => !request.url.includes(token)));
  } finally {
    mock.restore();
    restoreEnvironment("MAX_BOT_TOKEN", previousEnvironment.token);
    restoreEnvironment(
      "MAX_WEBHOOK_SECRET",
      previousEnvironment.integrationSecret,
    );
    restoreEnvironment(
      "MAX_WEBHOOK_SIGNING_SECRET",
      previousEnvironment.signingSecret,
    );
  }
});

test("uploads an XLSX through the MAX file endpoint and attaches its returned token", async () => {
  const previousToken = process.env.MAX_BOT_TOKEN;
  const botToken = "test-token-only-not-a-live-credential";
  const fileToken = "test-uploaded-file-token";
  process.env.MAX_BOT_TOKEN = botToken;
  const mock = mockMaxApiRequests((request) => {
    if (request.url.endsWith("/uploads?type=file")) {
      return {
        body: { url: "https://fu.oneme.ru/api/upload.do?signature=test" },
      };
    }
    if (request.url.startsWith("https://fu.oneme.ru/")) {
      return { body: { fileId: "test-file-id", token: fileToken } };
    }
    return { body: { message: {} } };
  });

  try {
    const uploadedToken = await uploadMaxFile({
      bytes: Buffer.from("xlsx test content"),
      fileName: "master-work-2026-11.xlsx",
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    assert.equal(uploadedToken, fileToken);
    assert.equal(mock.requests[0]?.authorization, botToken);
    assert.equal(
      mock.requests[1]?.url,
      "https://fu.oneme.ru/api/upload.do?signature=test",
    );
    assert.equal(mock.requests[1]?.authorization, null);
    assert.match(
      mock.requests[1]!.body,
      /Content-Disposition: form-data; name="data"; filename="master-work-2026-11\.xlsx"/u,
    );

    await sendMaxFileMessage("123456789", "Отчёт за месяц", uploadedToken);
    assert.equal(mock.requests[2]?.authorization, botToken);
    assert.deepEqual(JSON.parse(mock.requests[2]!.body), {
      text: "Отчёт за месяц",
      attachments: [{ type: "file", payload: { token: fileToken } }],
    });
  } finally {
    mock.restore();
    restoreEnvironment("MAX_BOT_TOKEN", previousToken);
  }
});
