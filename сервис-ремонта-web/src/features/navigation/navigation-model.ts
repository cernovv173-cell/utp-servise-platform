import {
  BookOpen,
  Boxes,
  ClipboardList,
  FileText,
  Home,
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

import { hasPermission, isFullAdministrator } from "@/features/auth/staff-access";

import type { User } from "@/lib/api";

const managementPermissions = [
  "customers",
  "shop_orders",
  "communications",
  "content",
  "reports",
  "company_settings",
  "staff_management",
] as const;

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
  | "/admin/salary-reports"
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

export const getNavigationGroupsForUser = (user: User): NavigationGroup[] => {
  if (user.role === "CUSTOMER") {
    return [
      {
        label: "Клиент",
        links: [
          { to: "/", label: "Главная", compactLabel: "Главная", icon: Home },
          { to: "/orders", label: "Ремонты", compactLabel: "Ремонты", icon: Wrench },
          { to: "/shop", label: "Магазин", compactLabel: "Магазин", icon: ShoppingBag },
          { to: "/loyalty", label: "Бонусы", compactLabel: "Бонусы", icon: Star },
          { to: "/account", label: "Профиль", compactLabel: "Профиль", icon: UserRound },
        ],
      },
    ];
  }

  const links: NavigationLink[] = [];
  if (user.role === "ADMIN") {
    links.push({
      to: "/admin/orders",
      label: "Заявки на ремонт",
      compactLabel: "Заявки",
      icon: ClipboardList,
    });
  }
  if (hasPermission(user, "repairs")) {
    links.push(
      { to: "/orders", label: "Назначенные заявки", compactLabel: "Заявки", icon: ClipboardList },
      { to: "/checks", label: "Чеки и выдача", compactLabel: "Чеки", icon: FileText },
      { to: "/salary", label: "Мои начисления", compactLabel: "Начисления", icon: Wallet },
    );
  }
  if (hasPermission(user, "repairs") || hasPermission(user, "inventory")) {
    links.push({ to: "/catalog", label: "Каталог", compactLabel: "Каталог", icon: Package });
  }
  if (hasPermission(user, "inventory")) {
    links.push({
      to: "/admin/procurement",
      label: "Склад и поставщики",
      compactLabel: "Склад",
      icon: Boxes,
    });
  }
  if (managementPermissions.some((permission) => hasPermission(user, permission))) {
    links.push({ to: "/admin", label: "Управление", compactLabel: "Управление", icon: Settings });
  }
  links.push({ to: "/account", label: "Профиль", compactLabel: "Профиль", icon: UserRound });
  return [{ label: isFullAdministrator(user) ? "Администратор" : "Сотрудник", links }];
};

export const getHelpNavigationLinksForUser = (user: User): HelpNavigationLink[] => {
  if (user.role === "CUSTOMER") {
    return [
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
    ];
  }
  const links: HelpNavigationLink[] = [];
  if (hasPermission(user, "repairs") || hasPermission(user, "communications")) {
    links.push({
      to: "/chats",
      label: "Сообщения по заявкам",
      compactLabel: "Сообщения",
      icon: MessageSquareText,
    });
  }
  if (hasPermission(user, "communications")) {
    links.push({
      to: "/support",
      label: "Поддержка клиентов",
      compactLabel: "Поддержка",
      icon: LifeBuoy,
    });
  }
  return links;
};

export const isNavigationItemActive = (
  active: string,
  route: NavigationRoute | HelpRoute,
): boolean => {
  if (active === route) return true;
  if (route === "/" || route === "/admin") return false;
  return active.startsWith(`${route}/`);
};
