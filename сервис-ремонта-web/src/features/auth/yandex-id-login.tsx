import { useState } from "react";

type YaAuthSuggest = {
  init: (
    parameters: { client_id: string; response_type: "token"; redirect_uri: string },
    tokenPageOrigin: string,
  ) => Promise<{ handler: () => Promise<unknown> }>;
};

declare global {
  interface Window {
    YaAuthSuggest?: YaAuthSuggest;
  }
}

const CLIENT_ID = import.meta.env.VITE_YANDEX_CLIENT_ID?.trim() ?? "";
const SUGGEST_SDK_URL =
  "https://yastatic.net/s3/passport-sdk/autofill/v1/sdk-suggest-with-polyfills-latest.js";

let sdkPromise: Promise<YaAuthSuggest> | null = null;

const loadYandexSuggestSdk = (): Promise<YaAuthSuggest> => {
  if (window.YaAuthSuggest) return Promise.resolve(window.YaAuthSuggest);
  if (sdkPromise) return sdkPromise;

  const pending: Promise<YaAuthSuggest> = new Promise<YaAuthSuggest>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SUGGEST_SDK_URL}"]`);
    const script = existing ?? document.createElement("script");
    script.src = SUGGEST_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (window.YaAuthSuggest) resolve(window.YaAuthSuggest);
      else reject(new Error("Не удалось загрузить вход через Яндекс ID."));
    };
    script.onerror = () => reject(new Error("Не удалось загрузить вход через Яндекс ID."));
    if (!existing) document.head.append(script);
  }).catch((error: unknown) => {
    sdkPromise = null;
    throw error;
  });

  sdkPromise = pending;
  return pending;
};

const extractAccessToken = (result: unknown): string | null => {
  if (typeof result === "string") return result.trim() || null;
  if (typeof result !== "object" || result === null) return null;
  const value =
    (result as { access_token?: unknown; accessToken?: unknown }).access_token ??
    (result as { accessToken?: unknown }).accessToken;
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

export const YandexIdLogin = ({
  busy,
  onError,
  onToken,
}: {
  busy: boolean;
  onError: (message: string) => void;
  onToken: (accessToken: string) => void;
}) => {
  const [loading, setLoading] = useState(false);
  if (!CLIENT_ID) return null;

  const startLogin = async () => {
    setLoading(true);
    try {
      const origin = window.location.origin;
      const redirectUri = `${origin}/yandex-token`;
      const sdk = await loadYandexSuggestSdk();
      const { handler } = await sdk.init(
        { client_id: CLIENT_ID, response_type: "token", redirect_uri: redirectUri },
        origin,
      );
      const accessToken = extractAccessToken(await handler());
      if (!accessToken) throw new Error("Яндекс ID не вернул токен входа.");
      onToken(accessToken);
    } catch (failure) {
      onError(failure instanceof Error ? failure.message : "Не удалось войти через Яндекс ID.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void startLogin()}
      disabled={busy || loading}
      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800"
    >
      <span className="grid size-6 place-items-center rounded-md bg-red-500 text-sm font-bold text-white">
        Я
      </span>
      {loading ? "Подключаем Яндекс ID…" : "Войти через Яндекс ID"}
    </button>
  );
};
