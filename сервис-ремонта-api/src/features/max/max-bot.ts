import { createHmac, timingSafeEqual } from "node:crypto";

export type MaxBotProfile = {
  readonly username: string;
};

export type MaxWebhookSubscription = {
  readonly url: string;
};

export class MaxApiError extends Error {
  constructor(
    readonly code: "NOT_CONFIGURED" | "NETWORK" | "API_ERROR",
    readonly errorCode?: number,
    readonly retryAfterSeconds?: number,
  ) {
    super("MAX Bot API request failed.");
    this.name = "MaxApiError";
  }
}

export const hasMaxBotToken = (): boolean =>
  Boolean(process.env.MAX_BOT_TOKEN?.trim());

const getBotToken = (): string => {
  const token = process.env.MAX_BOT_TOKEN?.trim();
  if (!token) throw new MaxApiError("NOT_CONFIGURED");
  return token;
};

export const maxWebhookSecret = (): string =>
  createHmac("sha256", getBotToken())
    .update("utp-servise-max-webhook-v1")
    .digest("base64url");

export const isMaxWebhookSecretValid = (value: string | undefined): boolean => {
  if (!value) return false;
  let expected: string;
  try {
    expected = maxWebhookSecret();
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

const apiUrl = (path: string): string => `https://platform-api2.max.ru${path}`;

const maxRequest = async <T>(
  path: string,
  options: { readonly method?: "GET" | "POST"; readonly body?: unknown } = {},
): Promise<T> => {
  const token = getBotToken();
  const url = apiUrl(path);
  const method = options.method ?? "GET";
  const body =
    options.body === undefined ? undefined : JSON.stringify(options.body);
  const proxyUrl = process.env.AMAZI_PROXY_URL?.trim();
  const proxyKey = process.env.AMAZI_PROXY_KEY?.trim();
  const proxyConfigured = Boolean(proxyUrl && proxyKey);
  if (Boolean(proxyUrl) !== Boolean(proxyKey)) {
    throw new MaxApiError("NOT_CONFIGURED");
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
            url,
            method,
            headers: {
              authorization: token,
              ...(body ? { "content-type": "application/json" } : {}),
            },
            ...(body ? { body, bodyEncoding: "utf8" } : {}),
          }),
          signal: AbortSignal.timeout(10_000),
        })
      : await fetch(url, {
          method,
          headers: {
            authorization: token,
            ...(body ? { "content-type": "application/json" } : {}),
          },
          ...(body ? { body } : {}),
          signal: AbortSignal.timeout(10_000),
        });
  } catch {
    throw new MaxApiError("NETWORK");
  }

  if (!response.ok) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new MaxApiError(
      "API_ERROR",
      response.status,
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new MaxApiError("API_ERROR", response.status);
  }
};

export const getMaxBotProfile = async (): Promise<MaxBotProfile> => {
  const profile = await maxRequest<{ readonly username?: string }>("/me");
  if (!profile.username || !/^[A-Za-z0-9_]{1,64}$/u.test(profile.username)) {
    throw new MaxApiError("API_ERROR");
  }
  return { username: profile.username };
};

export const sendMaxMessage = async (
  userId: string,
  text: string,
): Promise<void> => {
  await maxRequest(`/messages?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
    body: { text },
  });
};

export const getMaxWebhookSubscriptions = (): Promise<{
  readonly subscriptions: readonly MaxWebhookSubscription[];
}> => maxRequest("/subscriptions");

export const registerMaxWebhook = async (url: string): Promise<void> => {
  const result = await maxRequest<{ readonly success?: boolean }>(
    "/subscriptions",
    {
      method: "POST",
      body: {
        url,
        update_types: ["bot_started", "bot_stopped"],
        secret: maxWebhookSecret(),
      },
    },
  );
  if (!result.success) throw new MaxApiError("API_ERROR");
};
