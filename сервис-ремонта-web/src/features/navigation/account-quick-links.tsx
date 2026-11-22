import { Link } from "@tanstack/react-router";
import {
  Building2,
  Cpu,
  Gift,
  type LucideIcon,
  MessageCircle,
  Newspaper,
  Star,
  Wrench,
} from "lucide-react";

import type { Role } from "@/lib/api";

type AccountShortcut = {
  to:
    | "/devices"
    | "/business"
    | "/offers"
    | "/reviews"
    | "/news"
    | "/support"
    | "/about"
    | "/crafts"
    | "/chats";
  title: string;
  description: string;
  icon: LucideIcon;
};

const shortcutsByRole: Partial<Record<Role, readonly AccountShortcut[]>> = {
  CUSTOMER: [
    {
      to: "/business",
      title: "Кабинет компании",
      description: "Техника, ремонты и документы компании",
      icon: Building2,
    },
    {
      to: "/devices",
      title: "Моя техника",
      description: "Сохранённые устройства и напоминания",
      icon: Cpu,
    },
    { to: "/offers", title: "Акции", description: "Предложения и розыгрыши сервиса", icon: Gift },
    { to: "/reviews", title: "Отзывы", description: "Оценки завершённых ремонтов", icon: Star },
    {
      to: "/news",
      title: "Новости",
      description: "Объявления и полезные материалы",
      icon: Newspaper,
    },
    {
      to: "/support",
      title: "Помощь",
      description: "Написать администратору сервиса",
      icon: MessageCircle,
    },
    {
      to: "/about",
      title: "О компании",
      description: "Контакты, услуги и график",
      icon: Building2,
    },
    {
      to: "/crafts",
      title: "Изделия",
      description: "Готовые работы и заказные изделия",
      icon: Wrench,
    },
  ],
  TECHNICIAN: [
    {
      to: "/chats",
      title: "Сообщения",
      description: "Чаты по назначенным заявкам",
      icon: MessageCircle,
    },
    { to: "/reviews", title: "Отзывы", description: "Отзывы о завершённых ремонтах", icon: Star },
    {
      to: "/about",
      title: "О компании",
      description: "Контакты и график сервиса",
      icon: Building2,
    },
  ],
};

export const AccountQuickLinks = ({ role }: { role: Role | undefined }) => {
  const shortcuts = role ? (shortcutsByRole[role] ?? []) : [];
  if (shortcuts.length === 0) return null;

  return (
    <section className="mb-6" aria-labelledby="account-shortcuts-title">
      <div className="mb-3">
        <h2 id="account-shortcuts-title" className="text-lg font-semibold">
          Дополнительные разделы
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Все вспомогательные возможности собраны здесь, а не в основном меню.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {shortcuts.map(({ to, title, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white/90 p-4 transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-sm dark:border-[#405b9c]/40 dark:bg-[#0c142b]/90 dark:hover:border-[#5f7fe0]"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-cyan-200">
              <Icon size={19} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                {description}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
};
