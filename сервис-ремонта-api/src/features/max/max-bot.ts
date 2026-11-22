import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
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
    readonly apiErrorCode?: string,
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
          const responseText = Buffer.concat(chunks).toString("utf8");
          let responseBody: unknown;
          try {
            responseBody = JSON.parse(responseText) as unknown;
          } catch {
            responseBody = undefined;
          }
          if (statusCode < 200 || statusCode >= 300) {
            const retryAfter = Number(response.headers["retry-after"]);
            const errorBody =
              responseBody && typeof responseBody === "object"
                ? (responseBody as Record<string, unknown>)
                : undefined;
            const apiErrorCode =
              typeof errorBody?.code === "string"
                ? errorBody.code
                : typeof errorBody?.error_code === "string"
                  ? errorBody.error_code
                  : typeof errorBody?.error === "string"
                    ? errorBody.error
                    : undefined;
            reject(
              new MaxApiError(
                "API_ERROR",
                statusCode,
                Number.isFinite(retryAfter) && retryAfter > 0
                  ? retryAfter
                  : undefined,
                apiErrorCode,
              ),
            );
            return;
          }

          if (responseBody === undefined) {
            reject(new MaxApiError("API_ERROR", statusCode));
            return;
          }
          resolve(responseBody as T);
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

type MaxFileUpload = {
  readonly url?: unknown;
  readonly token?: unknown;
};

const uploadMaxFileBytes = async (input: {
  readonly url: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly bytes: Buffer;
}): Promise<string | null> => {
  const parsedUrl = new URL(input.url);
  if (
    parsedUrl.protocol !== "https:" ||
    !["fu.oneme.ru", "omu.okcdn.ru"].includes(parsedUrl.hostname)
  ) {
    throw new MaxApiError("API_ERROR");
  }

  const boundary = `----AmaziMax${randomUUID().replaceAll("-", "")}`;
  const prefix = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="data"; filename="${input.fileName}"\r\n` +
      `Content-Type: ${input.contentType}\r\n\r\n`,
    "utf8",
  );
  const suffix = Buffer.from(`\r\n--${boundary}--\r\n`, "utf8");
  const body = Buffer.concat([prefix, input.bytes, suffix]);

  return new Promise<string | null>((resolve, reject) => {
    const request = https.request(
      parsedUrl,
      {
        method: "POST",
        agent: maxApiAgent,
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": body.length,
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.once("error", () => reject(new MaxApiError("NETWORK")));
        response.once("end", () => {
          const statusCode = response.statusCode ?? 0;
          const responseText = Buffer.concat(chunks).toString("utf8");
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
          let result: unknown;
          try {
            result = JSON.parse(responseText) as unknown;
          } catch {
            result = undefined;
          }
          const token =
            result && typeof result === "object" && "token" in result
              ? result.token
              : undefined;
          resolve(typeof token === "string" && token.length > 0 ? token : null);
        });
      },
    );
    request.setTimeout(20_000, () => request.destroy());
    request.once("error", () => reject(new MaxApiError("NETWORK")));
    request.end(body);
  });
};

export const uploadMaxFile = async (input: {
  readonly bytes: Buffer;
  readonly fileName: string;
  readonly contentType: string;
}): Promise<string> => {
  if (
    input.bytes.length === 0 ||
    input.bytes.length > 10 * 1024 * 1024 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(input.fileName) ||
    !/^[A-Za-z0-9][A-Za-z0-9.+-]*\/[A-Za-z0-9][A-Za-z0-9.+-]*$/u.test(
      input.contentType,
    )
  ) {
    throw new MaxApiError("API_ERROR");
  }
  const upload = await maxRequest<MaxFileUpload>("/uploads?type=file", {
    method: "POST",
  });
  if (
    typeof upload.url !== "string" ||
    (upload.token !== undefined &&
      (typeof upload.token !== "string" || upload.token.length === 0))
  ) {
    throw new MaxApiError("API_ERROR");
  }
  const uploadedToken = await uploadMaxFileBytes({
    url: upload.url,
    fileName: input.fileName,
    contentType: input.contentType,
    bytes: input.bytes,
  });
  const token =
    uploadedToken ?? (typeof upload.token === "string" ? upload.token : null);
  if (!token) throw new MaxApiError("API_ERROR");
  return token;
};

export const sendMaxFileMessage = async (
  userId: string,
  text: string,
  fileToken: string,
): Promise<void> => {
  await maxRequest(`/messages?user_id=${encodeURIComponent(userId)}`, {
    method: "POST",
    body: {
      text,
      attachments: [{ type: "file", payload: { token: fileToken } }],
    },
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
