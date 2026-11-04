import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import https from "node:https";

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

const configuredWebhookSecrets = (): string[] =>
  [process.env.MAX_WEBHOOK_SIGNING_SECRET, process.env.MAX_WEBHOOK_SECRET]
    .map((secret) => secret?.trim())
    .filter(
      (secret): secret is string =>
        typeof secret === "string" && /^[A-Za-z0-9_-]{5,256}$/u.test(secret),
    );

export const hasMaxWebhookSecret = (): boolean =>
  configuredWebhookSecrets().length > 0;

const getBotToken = (): string => {
  const token = process.env.MAX_BOT_TOKEN?.trim();
  if (!token) throw new MaxApiError("NOT_CONFIGURED");
  return token;
};

export const maxWebhookSecret = (): string => {
  const secret = configuredWebhookSecrets()[0];
  if (!secret) throw new MaxApiError("NOT_CONFIGURED");
  return secret;
};

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
const maxApiAgent = new https.Agent({
  ca: readFileSync(
    new URL(
      "../../../certificates/russian-trusted-root-ca.pem",
      import.meta.url,
    ),
  ),
});

const maxRequest = async <T>(
  path: string,
  options: { readonly method?: "GET" | "POST"; readonly body?: unknown } = {},
): Promise<T> => {
  const token = getBotToken();
  const url = apiUrl(path);
  const method = options.method ?? "GET";
  const body =
    options.body === undefined ? undefined : JSON.stringify(options.body);
  return new Promise<T>((resolve, reject) => {
    const request = https.request(
      url,
      {
        method,
        agent: maxApiAgent,
        headers: {
          authorization: token,
          ...(body ? { "content-type": "application/json" } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.once("error", () => reject(new MaxApiError("NETWORK")));
        response.once("end", () => {
          const statusCode = response.statusCode ?? 0;
          if (statusCode < 200 || statusCode >= 300) {
            const retryAfter = Number(response.headers["retry-after"]);
            reject(
              new MaxApiError(
                "API_ERROR",
                statusCode,
                Number.isFinite(retryAfter) && retryAfter > 0
                  ? retryAfter
                  : undefined,
              ),
            );
            return;
          }

          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")) as T);
          } catch {
            reject(new MaxApiError("API_ERROR", statusCode));
          }
        });
      },
    );
    request.setTimeout(10_000, () => {
      request.destroy();
    });
    request.once("error", () => reject(new MaxApiError("NETWORK")));
    if (body) request.write(body);
    request.end();
  });
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

export const sendMaxContactRequest = async (
  userId: string,
  text: string,
): Promise<void> => {
  await maxRequest(`/messages?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
    body: {
      text,
      attachments: [
        {
          type: "inline_keyboard",
          payload: {
            buttons: [
              [{ type: "request_contact", text: "Поделиться контактом" }],
            ],
          },
        },
      ],
    },
  });
};

const normalizeVcfInfo = (value: string): string =>
  value.replace(/\\r\\n/gu, "\r\n").replace(/\\n/gu, "\n");

export const isMaxContactHashValid = (
  vcfInfo: string,
  hash: string,
): boolean => {
  const normalizedHash = hash.trim();
  if (!normalizedHash) return false;
  const normalizedVcfInfo = normalizeVcfInfo(vcfInfo);
  const expected = [
    createHmac("sha256", getBotToken()).update(normalizedVcfInfo).digest("hex"),
    createHmac("sha256", getBotToken())
      .update(normalizedVcfInfo)
      .digest("base64"),
  ];
  return expected.some((candidate) => {
    const actualBytes = Buffer.from(normalizedHash);
    const expectedBytes = Buffer.from(candidate);
    return (
      actualBytes.length === expectedBytes.length &&
      timingSafeEqual(actualBytes, expectedBytes)
    );
  });
};

export const normalizeMaxVcfInfo = normalizeVcfInfo;

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
        update_types: ["bot_started", "bot_stopped", "message_created"],
        secret: maxWebhookSecret(),
      },
    },
  );
  if (!result.success) throw new MaxApiError("API_ERROR");
};
