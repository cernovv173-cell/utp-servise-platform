import { Link } from "@tanstack/react-router";
import { ArrowRight, LogIn, Moon, Sun, Wrench } from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { AppInstallButton } from "@/components/app-install-button";

export const repairRequestHref = "/login?register=1&next=%2Forders";

export const PublicSiteShell = ({ children }: { children: ReactNode }) => {
  const [dark, setDark] = useState(() => localStorage.getItem("utp-web-theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("utp-web-theme", dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-dvh bg-slate-50/55 text-slate-900 dark:bg-transparent dark:text-[#edf2ff]">
      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/90 shadow-sm backdrop-blur dark:border-[#26365f]/80 dark:bg-[#080e20]/85">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
          <Link
            to="/"
            className="flex shrink-0 items-center gap-3 text-lg font-bold tracking-tight"
          >
            <span className="grid size-10 place-items-center rounded-xl bg-blue-600 text-white shadow-[0_0_22px_rgba(37,99,235,0.28)]">
              <Wrench size={20} aria-hidden="true" />
            </span>
            UTP Servise
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Основная навигация">
            <a
              href="/#services"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
            >
              Услуги
            </a>
            <a
              href="/#trust"
              className="rounded-xl px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"
            >
              Нам доверяют
            </a>
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
            <Link
              to="/login"
              className="hidden min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-100 sm:inline-flex dark:border-[#304373] dark:text-[#d5def6] dark:hover:bg-[#152449]"
            >
              <LogIn size={16} aria-hidden="true" />
              Войти
            </Link>
            <a
              href={repairRequestHref}
              className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-blue-600 px-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Заявка <ArrowRight size={16} aria-hidden="true" />
            </a>
          </div>
        </div>
        <nav
          className="flex gap-1 overflow-x-auto border-t border-slate-200/80 px-4 py-2 md:hidden dark:border-[#26365f]/80"
          aria-label="Навигация"
        >
          <a
            href="/#services"
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
          >
            Услуги
          </a>
          <a
            href="/#trust"
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
          >
            Нам доверяют
          </a>
          <Link
            to="/about"
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
          >
            О компании
          </Link>
          <Link
            to="/login"
            className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-[#a8b5d4]"
          >
            Войти
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="border-t border-slate-200/80 bg-white/70 dark:border-[#26365f]/80 dark:bg-[#080e20]/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between md:px-8">
          <div>
            <p className="font-semibold text-slate-800 dark:text-slate-200">UTP Servise</p>
            <p className="mt-1">Открытая информация о сервисе — без регистрации.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AppInstallButton />
            <a
              href={repairRequestHref}
              className="font-semibold text-blue-700 hover:underline dark:text-cyan-300"
            >
              Оформить заявку
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};
