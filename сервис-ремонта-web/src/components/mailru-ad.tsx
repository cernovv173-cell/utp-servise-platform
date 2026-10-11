import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    MRGtag?: unknown[];
  }
}

const SCRIPT_URL = "https://ad.mail.ru/static/ads-async.js";
const SCRIPT_SELECTOR = 'script[data-mailru-ads="true"]';

export const MailRuAd = () => {
  const [failed, setFailed] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current) return;
    requested.current = true;

    const requestAd = () => {
      (window.MRGtag = window.MRGtag || []).push({});
    };
    const handleError = () => setFailed(true);
    let script = document.querySelector<HTMLScriptElement>(SCRIPT_SELECTOR);

    if (script?.dataset.loaded === "true") {
      requestAd();
      return;
    }
    if (!script) {
      script = document.createElement("script");
      script.async = true;
      script.src = SCRIPT_URL;
      script.dataset.mailruAds = "true";
      script.addEventListener(
        "load",
        () => {
          script!.dataset.loaded = "true";
          requestAd();
        },
        { once: true },
      );
      script.addEventListener("error", handleError, { once: true });
      document.head.appendChild(script);
      return () => script?.removeEventListener("error", handleError);
    }

    const handleLoad = () => {
      script!.dataset.loaded = "true";
      requestAd();
    };
    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });
    return () => {
      script?.removeEventListener("load", handleLoad);
      script?.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <section className="my-6" aria-label="Реклама">
      <p className="mb-2 text-center text-xs text-slate-500">Реклама</p>
      <div className="mx-auto min-h-[280px] max-w-full overflow-hidden text-center">
        <ins
          className="mrg-tag"
          style={{ display: "inline-block", width: 336, height: 280, maxWidth: "100%" }}
          data-ad-client="ad-2087473"
          data-ad-slot="2087473"
        />
        {failed && (
          <p className="mt-2 text-xs text-slate-500">Рекламное объявление сейчас недоступно.</p>
        )}
      </div>
    </section>
  );
};
