import { Link } from "@tanstack/react-router";
import { ArrowRight, LogIn, Moon, ShoppingBag, Sun, X } from "lucide-react";
import { type ReactNode, createContext, useContext, useEffect, useState } from "react";

import { AppInstallButton } from "@/components/app-install-button";
import { BrandLogo } from "@/components/brand-logo";
import { Modal, ModalClose, ModalContent, ModalTitle } from "@/components/modal";

import { LoginExperience } from "@/features/auth/login-experience";

type PublicAuthIntent = "login" | "register";
type PublicAuthRequest = { intent: PublicAuthIntent; nextPath: string };
type OpenPublicAuthDialog = (intent: PublicAuthIntent, nextPath?: string) => void;

const PublicAuthDialogContext = createContext<OpenPublicAuthDialog | null>(null);

export const PublicAuthTrigger = ({
  children,
  className,
  intent = "login",
  nextPath,
}: {
  children: ReactNode;
  className?: string;
  intent?: PublicAuthIntent;
  nextPath?: string;
}) => {
  const openAuthDialog = useContext(PublicAuthDialogContext);
  const returnPath =
    nextPath ??
    (typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`);
  const query = new URLSearchParams({
    ...(intent === "register" ? { register: "1" } : {}),
    next: returnPath,
  });
  const href = `/login?${query.toString()}`;

  if (!openAuthDialog) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }

  return (
    <button type="button" onClick={() => openAuthDialog(intent, returnPath)} className={className}>
      {children}
    </button>
  );
};

export const PublicSiteShell = ({ children }: { children: ReactNode }) => {
  const [dark, setDark] = useState(() => localStorage.getItem("utp-web-theme") === "dark");
  const [authRequest, setAuthRequest] = useState<PublicAuthRequest | null>(null);

  const openAuthDialog: OpenPublicAuthDialog = (intent, nextPath = "/") => {
    const safeNextPath = nextPath.startsWith("/") && !nextPath.startsWith("//") ? nextPath : "/";
    setAuthRequest({ intent, nextPath: safeNextPath });
  };

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("utp-web-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <PublicAuthDialogContext.Provider value={openAuthDialog}>
      <div className="min-h-dvh bg-slate-50/55 text-slate-900 dark:bg-transparent dark:text-[#edf2ff] print:bg-white print:text-black">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-[#26365f]/80 dark:bg-[#080e20]/85 print:hidden">
          <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
            <Link
              to="/"
              className="flex shrink-0 items-center gap-3 text-lg font-bold tracking-tight"
            >
              <BrandLogo className="size-10 rounded-xl border border-slate-200 shadow-[0_0_22px_rgba(37,99,235,0.18)] dark:border-[#304373]" />
              ЕНОТ СЕРВИС
            </Link>
            <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
              <Link
                to="/uslugi"
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
              >
                Услуги
              </Link>
              <Link
                to="/shop"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
              >
                <ShoppingBag size={15} aria-hidden="true" /> Магазин
              </Link>
              <a
                href="/#reviews"
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
              >
                Отзывы
              </a>
              <Link
                to="/work-stories"
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
              >
                Примеры работ
              </Link>
              <Link
                to="/guides"
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
              >
                Полезное
              </Link>
              <Link
                to="/about"
                className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
              >
                О компании
              </Link>
            </nav>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Переключить тему"
                onClick={() => setDark((value) => !value)}
                className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-[#304373] dark:text-[#b6c8f4] dark:hover:bg-[#152449]"
              >
                {dark ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <PublicAuthTrigger
                intent="login"
                className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex dark:border-[#304373] dark:text-[#d5def6] dark:hover:bg-[#152449]"
              >
                <LogIn size={16} aria-hidden="true" />
                Войти
              </PublicAuthTrigger>
              <PublicAuthTrigger
                intent="register"
                nextPath="/orders"
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Заявка <ArrowRight size={16} aria-hidden="true" />
              </PublicAuthTrigger>
            </div>
          </div>
          <nav
            className="flex gap-1 overflow-x-auto border-t border-slate-200/80 px-4 py-2 md:hidden dark:border-[#26365f]/80"
            aria-label="Навигация"
          >
            <Link
              to="/uslugi"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              Услуги
            </Link>
            <a
              href="/#reviews"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              Отзывы
            </a>
            <Link
              to="/work-stories"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              Примеры работ
            </Link>
            <Link
              to="/guides"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              Памятки
            </Link>
            <Link
              to="/about"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              О компании
            </Link>
            <Link
              to="/shop"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              <ShoppingBag size={14} aria-hidden="true" /> Магазин
            </Link>
            <PublicAuthTrigger
              intent="login"
              nextPath="/news"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              Новости
            </PublicAuthTrigger>
            <PublicAuthTrigger
              intent="login"
              className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
            >
              Войти
            </PublicAuthTrigger>
          </nav>
        </header>
        <main>{children}</main>
        <footer className="border-t border-slate-200/80 bg-white/70 dark:border-[#26365f]/80 dark:bg-[#080e20]/70 print:hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex items-center gap-3">
              <BrandLogo className="size-10 rounded-xl border border-slate-200 dark:border-[#304373]" />
              <div>
                <p className="font-semibold text-slate-800 dark:text-slate-200">ЕНОТ СЕРВИС</p>
                <p className="mt-1">Открытая информация о сервисе — без регистрации.</p>
              </div>
            </div>
            <nav
              className="flex flex-wrap items-center gap-3"
              aria-label="Дополнительная навигация"
            >
              <Link
                to="/reviews"
                className="font-medium hover:text-blue-700 dark:hover:text-cyan-300"
              >
                Отзывы
              </Link>
              <Link
                to="/work-stories"
                className="font-medium hover:text-blue-700 dark:hover:text-cyan-300"
              >
                Примеры работ
              </Link>
              <Link
                to="/guides"
                className="font-medium hover:text-blue-700 dark:hover:text-cyan-300"
              >
                Памятки
              </Link>
              <Link
                to="/about"
                className="font-medium hover:text-blue-700 dark:hover:text-cyan-300"
              >
                О компании
              </Link>
              <a
                href="/privacy-policy.html"
                className="font-medium hover:text-blue-700 dark:hover:text-cyan-300"
              >
                Политика конфиденциальности
              </a>
              <PublicAuthTrigger
                intent="login"
                nextPath="/news"
                className="font-medium hover:text-blue-700 dark:hover:text-cyan-300"
              >
                Новости
              </PublicAuthTrigger>
              <AppInstallButton />
              <PublicAuthTrigger
                intent="register"
                nextPath="/orders"
                className="font-semibold text-blue-700 hover:underline dark:text-cyan-300"
              >
                Оформить заявку
              </PublicAuthTrigger>
            </nav>
          </div>
        </footer>
      </div>
      <Modal
        open={Boolean(authRequest)}
        onOpenChange={(open) => {
          if (!open) setAuthRequest(null);
        }}
      >
        {authRequest && (
          <ModalContent className="dark:border-slate-800 dark:bg-slate-950">
            <div className="mb-3 flex items-center justify-between gap-3">
              <ModalTitle className="sr-only">
                {authRequest.intent === "register"
                  ? "Регистрация в ЕНОТ СЕРВИС"
                  : "Вход в ЕНОТ СЕРВИС"}
              </ModalTitle>
              <ModalClose asChild>
                <button
                  type="button"
                  aria-label="Закрыть окно входа"
                  className="ml-auto grid size-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                >
                  <X size={18} aria-hidden="true" />
                </button>
              </ModalClose>
            </div>
            <LoginExperience
              key={authRequest.intent}
              mode="dialog"
              initialRegister={authRequest.intent === "register"}
              nextPath={authRequest.nextPath}
              onClose={() => setAuthRequest(null)}
            />
          </ModalContent>
        )}
      </Modal>
    </PublicAuthDialogContext.Provider>
  );
};
