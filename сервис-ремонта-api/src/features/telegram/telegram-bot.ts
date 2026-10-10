import { createHmac, timingSafeEqual } from "node:crypto";

type TelegramEnvelope<T> = {
  readonly ok: boolean;
  readonly result?: T;
  readonly error_code?: number;
  readonly parameters?: { readonly retry_after?: number };
};

export type TelegramBotProfile = {
  readonly username: string;
};

export type TelegramWebhookInfo = {
  readonly url: string;
};

export class TelegramApiError extends Error {
  constructor(
    readonly code: "NOT_CONFIGURED" | "NETWORK" | "API_ERROR",
    readonly errorCode?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super("Telegram Bot API request failed.");
    this.name = "TelegramApiError";
  }
}

const getBotToken = (): string => {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new TelegramApiError("NOT_CONFIGURED");
  return token;
};

export const telegramWebhookSecret = (): string =>
  createHmac("sha256", getBotToken())
    .update("utp-servise-telegram-webhook-v1")
    .digest("base64url");

export const isTelegramWebhookSecretValid = (
  value: string | undefined,
): boolean => {
  if (!value) return false;
  let expected: string;
  try {
    expected = telegramWebhookSecret();
  } catch {
    return false;
  }
  const actualBytes = Buffer.from(value);
  const expectedBytes = Buffer.from(expected);
  return (
    actualBytes.length === expectedBytes.length &&
    timingSafeEqual(actualBytes, expectedBytes)
  );
};

const telegramRequest = async <T>(
  method: string,
  payload: Record<string, unknown> = {},
): Promise<T> => {
  const token = getBotToken();
  const telegramUrl = `https://api.telegram.org/bot${token}/${method}`;
  const proxyUrl = process.env.AMAZI_PROXY_URL?.trim();
  const proxyKey = process.env.AMAZI_PROXY_KEY?.trim();
  const proxyConfigured = Boolean(proxyUrl && proxyKey);
  if (Boolean(proxyUrl) !== Boolean(proxyKey)) {
    throw new TelegramApiError("NOT_CONFIGURED");
  }
  let response: Response;
  try {
    response = proxyConfigured
      ? await fetch(proxyUrl!, {
          method: "POST",
          headers: {
            authorization: `Bearer ${proxyKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            url: telegramUrl,
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
            bodyEncoding: "utf8",
          }),
          signal: AbortSignal.timeout(10_000),
        })
      : await fetch(telegramUrl, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10_000),
        });
  } catch {
    throw new TelegramApiError("NETWORK");
  }

  let envelope: TelegramEnvelope<T> | undefined;
  try {
    envelope = (await response.json()) as TelegramEnvelope<T>;
  } catch {
    throw new TelegramApiError("API_ERROR", response.status);
  }
  if (!response.ok || !envelope.ok || envelope.result === undefined) {
    throw new TelegramApiError(
      "API_ERROR",
      envelope.error_code ?? response.status,
      envelope.parameters?.retry_after,
    );
  }
  return envelope.result;
};

export const getTelegramBotProfile = async (): Promise<TelegramBotProfile> => {
  const profile = await telegramRequest<{
    readonly username?: string;
  }>("getMe");
  if (!profile.username || !/^[A-Za-z0-9_]{5,32}$/u.test(profile.username)) {
    throw new TelegramApiError("API_ERROR");
  }
  return { username: profile.username };
};

export const sendTelegramMessage = async (
  chatId: string,
  text: string,
): Promise<void> => {
  await telegramRequest("sendMessage", { chat_id: chatId, text });
};

export const getTelegramWebhookInfo = (): Promise<TelegramWebhookInfo> =>
  telegramRequest<TelegramWebhookInfo>("getWebhookInfo");

export const registerTelegramWebhook = (url: string): Promise<boolean> =>
  telegramRequest<boolean>("setWebhook", {
    url,
    secret_token: telegramWebhookSecret(),
    allowed_updates: ["message"],
    drop_pending_updates: false,
  });
