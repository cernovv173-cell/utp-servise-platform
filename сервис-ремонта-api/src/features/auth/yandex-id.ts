import { z } from "zod";

import { HttpError } from "../../lib/http/http-error.js";

const yandexProfileSchema = z
  .object({
    id: z.string().trim().min(1).max(128),
    client_id: z.string().trim().min(1).max(128),
    login: z.string().trim().min(1).max(128),
    default_email: z.string().email().optional(),
    emails: z.array(z.string().email()).optional(),
    display_name: z.string().trim().max(240).optional(),
    real_name: z.string().trim().max(240).optional(),
    first_name: z.string().trim().max(120).optional(),
    last_name: z.string().trim().max(120).optional(),
  })
  .passthrough();

export type YandexIdentity = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
};

export const getYandexIdentity = async (
  accessToken: string,
  expectedClientId: string,
  fetcher: typeof fetch = fetch,
): Promise<YandexIdentity> => {
  let response: Response;
  try {
    response = await fetcher("https://login.yandex.ru/info?format=json", {
      headers: { Authorization: `OAuth ${accessToken}` },
      signal: AbortSignal.timeout(8_000),
    });
  } catch {
    throw new HttpError(
      502,
      "YANDEX_UNAVAILABLE",
      "Не удалось связаться с Яндекс ID. Попробуйте ещё раз.",
    );
  }

  if (!response.ok) {
    throw new HttpError(
      response.status >= 500 ? 502 : 401,
      response.status >= 500 ? "YANDEX_UNAVAILABLE" : "YANDEX_TOKEN_INVALID",
      response.status >= 500
        ? "Яндекс ID временно недоступен. Попробуйте ещё раз."
        : "Не удалось подтвердить вход через Яндекс ID.",
    );
  }

  const parsed = yandexProfileSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success || parsed.data.client_id !== expectedClientId) {
    throw new HttpError(
      401,
      "YANDEX_TOKEN_INVALID",
      "Не удалось подтвердить вход через Яндекс ID.",
    );
  }

  const email = (parsed.data.default_email ?? parsed.data.emails?.[0])
    ?.trim()
    .toLowerCase();
  if (!email) {
    throw new HttpError(
      400,
      "YANDEX_EMAIL_REQUIRED",
      "Разрешите доступ к адресу электронной почты в настройках приложения Яндекс OAuth и повторите вход.",
    );
  }

  const displayName = (
    parsed.data.real_name ??
    parsed.data.display_name ??
    [parsed.data.first_name, parsed.data.last_name].filter(Boolean).join(" ") ??
    parsed.data.login
  )
    .trim()
    .slice(0, 120);

  return {
    id: parsed.data.id,
    email,
    displayName: displayName || parsed.data.login,
  };
};
