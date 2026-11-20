import {
  BookOpen,
  ClipboardList,
  FileText,
  Home,
  Leaf,
  LifeBuoy,
  type LucideIcon,
  MessageSquareText,
  Package,
  Settings,
  ShoppingBag,
  Star,
  UserRound,
  Wallet,
  Wrench,
} from "lucide-react";

import type { Role } from "@/lib/api";

export type NavigationRoute =
  | "/"
  | "/orders"
  | "/checks"
  | "/shop"
  | "/loyalty"
  | "/account"
  | "/catalog"
  | "/salary"
  | "/admin"
  | "/admin/seasonal"
  | "/admin/orders"
  | "/admin/procurement";

export type HelpRoute = "/chats" | "/support" | "/guides" | "/feedback";

export type NavigationLink = {
  to: NavigationRoute;
  label: string;
  compactLabel: string;
  icon: LucideIcon;
};

export type HelpNavigationLink = {
  to: HelpRoute;
  label: string;
  compactLabel: string;
  icon: LucideIcon;
};

export type NavigationGroup = {
  label: string;
  links: NavigationLink[];
};

const navigationByRole: Record<Role, NavigationGroup> = {
  CUSTOMER: {
    label: "Клиент",
    links: [
      { to: "/", label: "Главная", compactLabel: "Главная", icon: Home },
      { to: "/orders", label: "Ремонты", compactLabel: "Ремонты", icon: Wrench },
      { to: "/shop", label: "Магазин", compactLabel: "Магазин", icon: ShoppingBag },
      { to: "/loyalty", label: "Бонусы", compactLabel: "Бонусы", icon: Star },
      { to: "/account", label: "Профиль", compactLabel: "Профиль", icon: UserRound },
    ],
  },
  TECHNICIAN: {
    label: "Мастер",
    links: [
      { to: "/orders", label: "Заявки", compactLabel: "Заявки", icon: ClipboardList },
      { to: "/checks", label: "Чеки и выдача", compactLabel: "Чеки", icon: FileText },
      { to: "/catalog", label: "Каталог", compactLabel: "Каталог", icon: Package },
      { to: "/salary", label: "Зарплата", compactLabel: "Зарплата", icon: Wallet },
      { to: "/account", label: "Профиль", compactLabel: "Профиль", icon: UserRound },
    ],
  },
  PROCUREMENT: {
    label: "Закупка",
    links: [
      { to: "/admin/procurement", label: "Закупки", compactLabel: "Закупки", icon: ClipboardList },
      { to: "/catalog", label: "Товары", compactLabel: "Товары", icon: Package },
      { to: "/account", label: "Профиль", compactLabel: "Профиль", icon: UserRound },
    ],
  },
  ADMIN: {
    label: "Администратор Енот-сервис.рф",
    links: [
      { to: "/admin/orders", label: "Заявки", compactLabel: "Заявки", icon: ClipboardList },
      { to: "/admin", label: "Управление", compactLabel: "Управление", icon: Settings },
      { to: "/admin/seasonal", label: "Оформление", compactLabel: "Сезон", icon: Leaf },
      { to: "/catalog", label: "Каталог", compactLabel: "Каталог", icon: Package },
      { to: "/account", label: "Профиль", compactLabel: "Профиль", icon: UserRound },
    ],
  },
};

const helpLinksByRole: Record<Role, HelpNavigationLink[]> = {
  CUSTOMER: [
    {
      to: "/chats",
      label: "Сообщения по заявкам",
      compactLabel: "Сообщения",
      icon: MessageSquareText,
    },
    { to: "/guides", label: "Полезные памятки", compactLabel: "Памятки", icon: BookOpen },
    { to: "/support", label: "Поддержка клиентов", compactLabel: "Поддержка", icon: LifeBuoy },
    {
      to: "/feedback",
      label: "Жалобы и предложения",
      compactLabel: "Обратная связь",
      icon: MessageSquareText,
    },
  ],
  TECHNICIAN: [
    {
      to: "/chats",
      label: "Сообщения по заявкам",
      compactLabel: "Сообщения",
      icon: MessageSquareText,
    },
  ],
  ADMIN: [
    {
      to: "/chats",
      label: "Сообщения по заявкам",
      compactLabel: "Сообщения",
      icon: MessageSquareText,
    },
    { to: "/support", label: "Поддержка клиентов", compactLabel: "Поддержка", icon: LifeBuoy },
  ],
  PROCUREMENT: [],
};

export const getNavigationGroupsForRole = (role: Role): NavigationGroup[] => [
  navigationByRole[role],
];

export const getPrimaryNavigationLinksForRole = (role: Role): NavigationLink[] =>
  navigationByRole[role].links;

export const getHelpNavigationLinksForRole = (role: Role): HelpNavigationLink[] =>
  helpLinksByRole[role];

export const isNavigationItemActive = (
  active: string,
  route: NavigationRoute | HelpRoute,
): boolean => {
  if (active === route) return true;
  if (route === "/" || route === "/admin") return false;
  return active.startsWith(`${route}/`);
};
