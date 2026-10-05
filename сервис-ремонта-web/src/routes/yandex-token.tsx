import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

type YaSendSuggestToken = (origin: string, options: { flag: true }) => void;

declare global {
  interface Window {
    YaSendSuggestToken?: YaSendSuggestToken;
  }
}

const TOKEN_SDK_URL =
  "https://yastatic.net/s3/passport-sdk/autofill/v1/sdk-suggest-token-with-polyfills-latest.js";

const YandexTokenCallbackPage = () => {
  const [message, setMessage] = useState("Завершаем вход через Яндекс ID…");

  useEffect(() => {
    const script = document.createElement("script");
    script.src = TOKEN_SDK_URL;
    script.async = true;
    script.onload = () => {
      if (!window.YaSendSuggestToken) {
        setMessage("Не удалось завершить вход. Вернитесь и попробуйте ещё раз.");
        return;
      }
      window.YaSendSuggestToken(window.location.origin, { flag: true });
    };
    script.onerror = () => setMessage("Не удалось завершить вход. Вернитесь и попробуйте ещё раз.");
    document.head.append(script);
    return () => script.remove();
  }, []);

  return (
    <main className="grid min-h-dvh place-items-center bg-slate-50 p-6 text-center dark:bg-slate-950">
      <p className="text-sm text-slate-600 dark:text-slate-300" role="status">
        {message}
      </p>
    </main>
  );
};

export const Route = createFileRoute("/yandex-token")({ component: YandexTokenCallbackPage });
