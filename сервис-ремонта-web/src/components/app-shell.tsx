import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  Bell,
  Boxes,
  CircleUserRound,
  ClipboardList,
  FileText,
  Home,
  LogOut,
  Moon,
  Megaphone,
  Newspaper,
  Power,
  Sparkles,
  Star,
  Sun,
  UsersRound,
  Wallet,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";

import { AppInstallButton } from "@/components/app-install-button";

import { AdminOrderCreate } from "@/features/admin/admin-order-create";
import { useAuth } from "@/features/auth/auth-context";

const links = [
  { to: "/", label: "Главная", icon: Home },
  { to: "/orders", label: "Заявки", icon: ClipboardList },
  { to: "/catalog", label: "Каталог ремонта", icon: Boxes },
  { to: "/checks", label: "Чеки и номера", icon: FileText },
  { to: "/news", label: "Новости", icon: Newspaper },
  { to: "/loyalty", label: "Бонусы", icon: Star },
  { to: "/salary", label: "Зарплата", icon: Wallet },
  { to: "/crafts", label: "Рукоделия", icon: Sparkles },
  { to: "/about", label: "О компании", icon: UsersRound },
  { to: "/reviews", label: "Отзывы", icon: Bell },
  { to: "/advertising", label: "Реклама", icon: Megaphone },
  { to: "/account", label: "Личный кабинет", icon: CircleUserRound },
];

export const AppShell = ({ active, children }: { active: string; children: ReactNode }) => {
  const { user, ready, logout } = useAuth();
  const queryClient = useQueryClient();
  const [dark, setDark] = useState(() => localStorage.getItem("utp-web-theme") !== "light");

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("utp-web-theme", dark ? "dark" : "light");
  }, [dark]);

  if (!ready)
    return (
      <div className="grid min-h-dvh place-items-center text-slate-500">Загружаем профиль…</div>
    );
  if (!user) {
    return (
      <main className="grid min-h-dvh place-items-center bg-slate-50 p-6 dark:bg-slate-950">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-100 text-xl font-bold text-blue-700">
            U
          </div>
          <h1 className="mt-5 text-2xl font-semibold text-slate-950 dark:text-white">
            Войдите в UTP Servise
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Заявки, история ремонта и новости доступны после входа в аккаунт.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 font-semibold text-white hover:bg-blue-700"
          >
            Войти или зарегистрироваться
          </Link>
          <div className="mt-4">
            <AppInstallButton />
          </div>
        </section>
      </main>
    );
  }

  const nav = links.filter((link) => {
    if (link.to === "/advertising") return user.role === "ADMIN";
    if (link.to === "/catalog" || link.to === "/salary")
      return user.role === "TECHNICIAN" || user.role === "ADMIN";
    if (link.to === "/loyalty") return user.role === "CUSTOMER";
    return true;
  });
  return (
    <div className="app-shell min-h-dvh bg-slate-50/80 text-slate-900 dark:bg-transparent dark:text-[#edf2ff]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-slate-200 bg-white px-4 py-6 shadow-sm lg:flex dark:border-[#26365f] dark:bg-[#080e20]/95 dark:shadow-[8px_0_38px_rgba(0,0,0,0.22)]">
        <Link to="/" className="flex items-center gap-3 px-2 text-lg font-bold tracking-tight">
          <span className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#55e6ff] via-[#5580ff] to-[#ad65ff] text-white shadow-[0_0_24px_rgba(83,121,255,0.5)]">
            U
          </span>
          UTP Servise
        </Link>
        <p className="mt-8 px-3 text-xs font-semibold tracking-[0.16em] text-slate-400 uppercase">
          Меню
        </p>
        <nav className="mt-3 grid gap-1">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-medium transition ${active === to ? "border-blue-100 bg-blue-50 text-blue-700 dark:border-[#405cc0]/50 dark:bg-[#17264b] dark:text-[#92eaff] dark:shadow-[inset_0_0_18px_rgba(77,120,255,0.12)]" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:border-[#26365f] dark:hover:bg-[#101a34]"}`}
            >
              <Icon size={18} />
              {label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <>
              <Link
                to="/admin"
                className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-medium ${active === "/admin" ? "border-[#405cc0]/50 bg-[#17264b] text-[#92eaff] dark:shadow-[inset_0_0_18px_rgba(77,120,255,0.12)]" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:border-[#26365f] dark:hover:bg-[#101a34]"}`}
              >
                <UsersRound size={18} />
                Администрирование
              </Link>
            </>
          )}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4 dark:border-[#26365f]">
          <p className="truncate px-3 text-sm font-semibold">{user.displayName}</p>
          <p className="truncate px-3 pt-1 text-xs text-slate-500">{user.email}</p>
          <button
            onClick={logout}
            className="mt-4 flex min-h-10 w-full items-center gap-3 rounded-xl px-3 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <LogOut size={17} />
            Выйти
          </button>
        </div>
      </aside>
      <div className="lg:pl-60">
        <header className="sticky top-0 z-10 flex min-h-16 items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 shadow-sm backdrop-blur md:px-8 dark:border-[#26365f]/80 dark:bg-[#080e20]/85 dark:shadow-[0_8px_32px_rgba(0,0,0,0.14)]">
          <Link to="/" className="flex items-center gap-2 font-bold lg:hidden">
            <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-[#55e6ff] via-[#5580ff] to-[#ad65ff] text-white shadow-[0_0_18px_rgba(83,121,255,0.45)]">
              U
            </span>
            UTP Servise
          </Link>
          <div className="hidden text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase lg:block dark:text-[#91a5d6]">
            Сервис ремонта техники
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:block dark:text-slate-300">
              {user.displayName}
            </span>
            <button
              aria-label="Переключить тему"
              onClick={() => setDark((value) => !value)}
              className="grid size-10 place-items-center rounded-xl border border-slate-200 text-slate-600 transition hover:bg-slate-50 dark:border-[#304373] dark:text-[#b6c8f4] dark:hover:border-[#5f7fe0] dark:hover:bg-[#152449] dark:hover:text-[#9aeeff]"
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 lg:hidden dark:border-[#26365f] dark:bg-[#080e20]">
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium ${active === to ? "border-blue-100 bg-blue-50 text-blue-700 dark:border-[#405cc0]/50 dark:bg-[#17264b] dark:text-[#92eaff]" : "border-transparent text-slate-600 dark:text-[#a8b5d4]"}`}
            >
              <Icon size={15} />
              {label}
            </Link>
          ))}
          {user.role === "ADMIN" && (
            <>
              <Link
                to="/admin"
                className="shrink-0 rounded-lg px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300"
              >
                Админ
              </Link>
            </>
          )}
        </nav>
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-9">
          <div className="mb-5 flex justify-end">
            <AppInstallButton />
          </div>
          {children}
        </main>
      </div>
      {user.role === "ADMIN" && (
        <div className="fixed right-5 bottom-5 z-30">
          <AdminOrderCreate
            onCreated={() => queryClient.invalidateQueries({ queryKey: ["orders"] })}
            trigger={
              <>
                <Power size={18} aria-hidden="true" />
                <span className="grid text-left leading-tight">
                  <span className="text-[10px] tracking-[0.16em]">СТАРТ / СТОП</span>
                  <span>Создать заявку</span>
                </span>
              </>
            }
            triggerClassName="flex min-h-14 items-center gap-3 rounded-full border border-cyan-200/50 bg-gradient-to-r from-[#102a4e] via-[#2855a8] to-[#57378e] px-5 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(49,114,255,0.38)] transition hover:scale-[1.03] hover:shadow-[0_10px_38px_rgba(64,204,255,0.4)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
          />
        </div>
      )}
    </div>
  );
};

export const PageTitle = ({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) => (
  <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
    <div>
      {eyebrow && (
        <p className="mb-2 text-xs font-bold tracking-[0.18em] text-blue-600 uppercase dark:text-[#77e7ff]">
          {eyebrow}
        </p>
      )}
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      {description && (
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
          {description}
        </p>
      )}
    </div>
    {action}
  </div>
);

export const SectionCard = ({
  children,
  className = "",
  dataPrintTarget,
}: {
  children: ReactNode;
  className?: string;
  dataPrintTarget?: "true" | "false";
}) => (
  <section
    data-print-target={dataPrintTarget}
    className={`app-card rounded-2xl border border-slate-200 bg-white/95 p-5 shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 dark:shadow-[0_12px_36px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(189,209,255,0.04)] dark:backdrop-blur-xl ${className}`}
    style={undefined}
  >
    {children}
  </section>
);
