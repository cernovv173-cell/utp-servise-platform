import { MessageCircle, RotateCcw, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
  type AuthResponse,
  type MaxLoginStart,
  type Role,
  maxLoginConfigRequest,
  pollMaxLoginRequest,
  startMaxLoginRequest,
} from "@/lib/api";
import { russianErrorMessage } from "@/lib/request-json";

type MaxLoginPhase = "idle" | "starting" | "waiting" | "error";

const openMaxChat = (url: string, popup: Window | null) => {
  if (popup && !popup.closed) {
    popup.location.replace(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

const errorMessage = (failure: unknown): string =>
  failure instanceof Error
    ? russianErrorMessage(failure.message)
    : "Не удалось начать вход через МАКС. Попробуйте ещё раз.";

export const MaxLogin = ({
  referralCode,
  expectedRole = "CUSTOMER",
  compact = false,
  disabled = false,
  onError,
  onSuccess,
}: {
  referralCode?: string;
  expectedRole?: Role;
  compact?: boolean;
  disabled?: boolean;
  onError: (message: string) => void;
  onSuccess: (session: AuthResponse) => void;
}) => {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<MaxLoginPhase>("idle");
  const [start, setStart] = useState<MaxLoginStart | null>(null);
  const [pollStatus, setPollStatus] = useState<"pending" | "awaiting_contact" | null>(null);
  const [error, setError] = useState("");
  const successRef = useRef(onSuccess);
  const pollNowRef = useRef<() => void>(() => undefined);

  const showError = (message: string) => {
    setError(message);
    toast.error(message);
  };

  useEffect(() => {
    successRef.current = onSuccess;
  }, [onSuccess]);

  useEffect(() => {
    let active = true;
    void maxLoginConfigRequest()
      .then((config) => {
        if (active) setAvailable(config.available);
      })
      .catch(() => {
        if (active) {
          setAvailable(false);
          toast.error("Не удалось проверить доступность входа через МАКС.");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!start) return;
    let cancelled = false;
    let inFlight = false;
    let timer: number | null = null;
    const deadline = new Date(start.expiresAt).getTime();

    const tick = async () => {
      if (cancelled || inFlight) return;
      inFlight = true;
      try {
        const result = await pollMaxLoginRequest(start.pollToken);
        if (cancelled) return;
        if (result.status === "completed") {
          setPhase("idle");
          setPollStatus(null);
          successRef.current({
            accessToken: result.accessToken,
            expiresAt: result.expiresAt,
            user: result.user,
            accountCreated: result.accountCreated,
            referralApplied: result.referralApplied,
          });
          return;
        }
        if (result.status === "failed" || result.status === "expired") {
          showError(result.message);
          setPhase("error");
          return;
        }
        setPollStatus(result.status);
        if (Date.now() >= deadline) {
          showError("Время ожидания истекло. Нажмите «Попробовать снова».");
          setPhase("error");
          return;
        }
        timer = window.setTimeout(() => void tick(), 2_000);
      } catch (failure) {
        if (cancelled) return;
        showError(errorMessage(failure));
        setPhase("error");
      } finally {
        inFlight = false;
      }
    };

    pollNowRef.current = () => {
      if (timer !== null) window.clearTimeout(timer);
      void tick();
    };
    const onFocus = () => pollNowRef.current();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    void tick();

    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [start]);

  const begin = async () => {
    setPhase("starting");
    setError("");
    onError("");
    // Opening the tab inside the click keeps the browser popup gesture intact.
    const popup = window.open("about:blank", "_blank");
    if (popup) popup.opener = null;
    try {
      const started = await startMaxLoginRequest(referralCode, expectedRole);
      setStart(started);
      setPollStatus("pending");
      setPhase("waiting");
      openMaxChat(started.url, popup);
    } catch (failure) {
      popup?.close();
      showError(errorMessage(failure));
      setPhase("error");
    }
  };

  const cancel = () => {
    setStart(null);
    setPollStatus(null);
    setPhase("idle");
    setError("");
  };

  if (available === null) {
    return compact ? (
      <button
        type="button"
        disabled
        aria-label="Проверяем вход через МАКС"
        className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-500 dark:border-slate-700"
      >
        <MessageCircle size={15} aria-hidden="true" /> МАКС…
      </button>
    ) : null;
  }
  if (available === false) {
    if (compact) {
      return (
        <button
          type="button"
          disabled
          title="Вход через МАКС временно недоступен"
          aria-label="Вход через МАКС временно недоступен"
          className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 px-3 text-sm font-semibold text-slate-400 dark:border-slate-700"
        >
          <MessageCircle size={15} aria-hidden="true" /> МАКС
        </button>
      );
    }
    return (
      <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
        Вход через МАКС временно недоступен. Войдите по почте или попробуйте позже.
      </p>
    );
  }

  return (
    <section
      aria-labelledby="max-login-title"
      className={
        compact
          ? "grid justify-items-start gap-2"
          : "rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 via-white to-cyan-50 p-4 dark:border-blue-900 dark:from-blue-950/40 dark:via-slate-900 dark:to-cyan-950/30"
      }
    >
      {!compact && (
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
            <MessageCircle size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="max-login-title" className="font-semibold">
              Вход и регистрация через МАКС
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              Без пароля: бот подтвердит ваш номер телефона. Если аккаунта ещё нет, он создастся
              автоматически.
            </p>
          </div>
        </div>
      )}

      {phase === "idle" || phase === "starting" || phase === "error" ? (
        <div className={compact ? "grid gap-2" : "mt-4 grid gap-3"}>
          {error && (
            <p role="alert" className="text-sm text-rose-600">
              {error}
            </p>
          )}
          <button
            type="button"
            onClick={() => void begin()}
            disabled={disabled || phase === "starting"}
            className={
              compact
                ? "inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                : "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            }
          >
            {phase === "starting" ? (
              compact ? (
                "Открываем…"
              ) : (
                "Открываем МАКС…"
              )
            ) : phase === "error" ? (
              <>
                <RotateCcw size={18} aria-hidden="true" />
                compact ? "Повторить МАКС" : "Попробовать снова"
              </>
            ) : (
              <>
                <MessageCircle size={18} aria-hidden="true" />
                {compact ? "МАКС" : "Продолжить в МАКС"}
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="mt-4 grid gap-3" aria-live="polite">
          <div
            role="status"
            className="flex items-start gap-3 rounded-xl border border-blue-200 bg-white/80 p-3 text-sm leading-6 dark:border-blue-900 dark:bg-slate-900/80"
          >
            <span
              className="mt-1 size-4 shrink-0 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600"
              aria-hidden="true"
            />
            <div>
              <p className="font-semibold">
                {pollStatus === "awaiting_contact"
                  ? "Подтвердите номер телефона в боте"
                  : "Ожидаем подтверждение в МАКС"}
              </p>
              <p className="mt-1 text-slate-600 dark:text-slate-300">
                {pollStatus === "awaiting_contact"
                  ? "В чате с ботом нажмите «Поделиться контактом». Это подтвердит, что номер принадлежит вам."
                  : "Откройте МАКС и нажмите «Начать» в чате с ботом. Если чат уже открыт, подтверждение придёт сразу."}
              </p>
            </div>
          </div>
          {start && (
            <a
              href={start.url}
              target="_blank"
              rel="noreferrer"
              className="flex min-h-11 items-center justify-center rounded-xl border border-blue-200 bg-white px-4 text-sm font-semibold text-blue-700 hover:bg-blue-50 dark:border-blue-900 dark:bg-slate-900 dark:text-blue-300 dark:hover:bg-slate-800"
            >
              Открыть чат с ботом ещё раз
            </a>
          )}
          <button
            type="button"
            onClick={cancel}
            className="min-h-10 text-sm text-slate-600 hover:text-blue-700 dark:text-slate-300"
          >
            Отменить
          </button>
        </div>
      )}

      {!compact && (
        <p className="mt-3 flex items-start gap-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
          <ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Продолжая, вы разрешаете использовать номер телефона из МАКС для входа и связи по
            заказам.{" "}
            <a
              href="/privacy-policy.html"
              className="underline underline-offset-2 hover:text-blue-700"
            >
              Политика конфиденциальности
            </a>
          </span>
        </p>
      )}
    </section>
  );
};
