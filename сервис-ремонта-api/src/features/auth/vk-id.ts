import { z } from "zod";

import { HttpError } from "../../lib/http/http-error.js";

const vkProfileSchema = z
  .object({
    user: z.object({
      user_id: z.union([z.string(), z.number()]),
      email: z.string().email().optional(),
      first_name: z.string().trim().max(120).optional(),
      last_name: z.string().trim().max(120).optional(),
    }),
  })
  .passthrough();

export type VkIdentity = {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
};

export const getVkIdentity = async (
  accessToken: string,
  appId: string,
  fetcher: typeof fetch = fetch,
): Promise<VkIdentity> => {
  let response: Response;
  try {
    response = await fetcher(
      `https://id.vk.ru/oauth2/user_info?client_id=${encodeURIComponent(appId)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ access_token: accessToken }),
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    throw new HttpError(
      502,
      "VK_UNAVAILABLE",
      "Не удалось связаться с VK ID. Попробуйте ещё раз.",
    );
  }
  if (!response.ok) {
    throw new HttpError(
      response.status >= 500 ? 502 : 401,
      response.status >= 500 ? "VK_UNAVAILABLE" : "VK_TOKEN_INVALID",
      response.status >= 500
        ? "VK ID временно недоступен. Попробуйте ещё раз."
        : "Не удалось подтвердить вход через VK ID.",
    );
  }
  const parsed = vkProfileSchema.safeParse(
    await response.json().catch(() => null),
  );
  if (!parsed.success) {
    throw new HttpError(
      401,
      "VK_TOKEN_INVALID",
      "Не удалось подтвердить вход через VK ID.",
    );
  }
  const email = parsed.data.user.email?.trim().toLowerCase();
  if (!email) {
    throw new HttpError(
      400,
      "VK_EMAIL_REQUIRED",
      "Разрешите VK ID доступ к электронной почте и повторите вход.",
    );
  }
  const displayName = [parsed.data.user.first_name, parsed.data.user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  return {
    id: String(parsed.data.user.user_id),
    email,
    displayName: displayName || email,
  };
};
