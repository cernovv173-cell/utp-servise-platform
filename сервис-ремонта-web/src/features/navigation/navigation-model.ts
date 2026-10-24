import type { RaccoonMotion } from "@/components/raccoon-icon";

import type { Role } from "@/lib/api";

export type NavigationRoute =
  | "/"
  | "/orders"
  | "/shop"
  | "/devices"
  | "/catalog"
  | "/checks"
  | "/news"
  | "/offers"
  | "/loyalty"
  | "/salary"
  | "/crafts"
  | "/about"
  | "/reviews"
  | "/advertising"
  | "/account"
  | "/support"
  | "/chats"
  | "/admin"
  | "/admin/overview"
  | "/admin/orders"
  | "/admin/customers"
  | "/admin/order-editing"
  | "/admin/procurement"
  | "/admin/schedule"
  | "/admin/shop-orders";

export type NavigationLink = {
  to: NavigationRoute;
  label: string;
  compactLabel: string;
  motion: RaccoonMotion;
  roles?: readonly Role[];
};

export type NavigationGroup = {
  label: string;
  links: NavigationLink[];
};

const navigationGroups: Array<{ label: string; links: NavigationLink[] }> = [
  {
    label: "Основное",
    links: [
      { to: "/", label: "Главная", compactLabel: "Главная", motion: "peek" },
      { to: "/orders", label: "Заявки", compactLabel: "Заявки", motion: "bounce" },
      { to: "/chats", label: "Чаты", compactLabel: "Чаты", motion: "bounce" },
      { to: "/checks", label: "Чеки и номера", compactLabel: "Чеки", motion: "bounce" },
    ],
  },
  {
    label: "Сервис",
    links: [
      {
        to: "/catalog",
        label: "Каталог ремонта",
        compactLabel: "Каталог",
        motion: "wiggle",
        roles: ["TECHNICIAN", "ADMIN"],
      },
      {
        to: "/salary",
        label: "Зарплата",
        compactLabel: "Зарплата",
        motion: "bounce",
        roles: ["TECHNICIAN", "ADMIN"],
      },
    ],
  },
  {
    label: "Для клиентов",
    links: [
      {
        to: "/shop",
        label: "Магазин товаров",
        compactLabel: "Магазин",
        motion: "peek",
        roles: ["CUSTOMER"],
      },
      {
        to: "/devices",
        label: "Моя техника",
        compactLabel: "Техника",
        motion: "peek",
        roles: ["CUSTOMER"],
      },
      { to: "/news", label: "Новости", compactLabel: "Новости", motion: "peek" },
      {
        to: "/offers",
        label: "Акции и розыгрыши",
        compactLabel: "Акции",
        motion: "bounce",
        roles: ["CUSTOMER"],
      },
      {
        to: "/loyalty",
        label: "Бонусы",
        compactLabel: "Бонусы",
        motion: "wiggle",
        roles: ["CUSTOMER"],
      },
      { to: "/crafts", label: "Ручная работа", compactLabel: "Изделия", motion: "peek" },
      { to: "/about", label: "О компании", compactLabel: "Компания", motion: "wiggle" },
      { to: "/reviews", label: "Отзывы", compactLabel: "Отзывы", motion: "bounce" },
      {
        to: "/support",
        label: "Поддержка",
        compactLabel: "Помощь",
        motion: "bounce",
        roles: ["CUSTOMER", "ADMIN"],
      },
    ],
  },
  {
    label: "Профиль",
    links: [{ to: "/account", label: "Личный кабинет", compactLabel: "Профиль", motion: "wiggle" }],
  },
  {
    label: "Администрирование",
    links: [
      {
        to: "/admin",
        label: "Панель администратора",
        compactLabel: "Админ",
        motion: "wiggle",
        roles: ["ADMIN"],
      },
      {
        to: "/admin/overview",
        label: "Обзор сервиса",
        compactLabel: "Обзор",
        motion: "peek",
        roles: ["ADMIN"],
      },
      {
        to: "/admin/orders",
        label: "Заявки на ремонт",
        compactLabel: "Заявки сервиса",
        motion: "bounce",
        roles: ["ADMIN"],
      },
      {
        to: "/admin/schedule",
        label: "Расписание мастеров",
        compactLabel: "Расписание",
        motion: "peek",
        roles: ["ADMIN"],
      },
      {
        to: "/admin/procurement",
        label: "Закупка запчастей",
        compactLabel: "Закупка",
        motion: "peek",
        roles: ["ADMIN"],
      },
      {
        to: "/admin/customers",
        label: "База клиентов",
        compactLabel: "Клиенты",
        motion: "peek",
        roles: ["ADMIN"],
      },
      {
        to: "/admin/order-editing",
        label: "Редактирование заявок",
        compactLabel: "Правка заявок",
        motion: "wiggle",
        roles: ["ADMIN"],
      },
      {
        to: "/admin/shop-orders",
        label: "Подтверждение заказов магазина",
        compactLabel: "Заказы магазина",
        motion: "peek",
        roles: ["ADMIN"],
      },
      {
        to: "/advertising",
        label: "Реклама",
        compactLabel: "Реклама",
        motion: "peek",
        roles: ["ADMIN"],
      },
    ],
  },
];

const primaryRoutes: Record<Role, readonly NavigationRoute[]> = {
  CUSTOMER: ["/", "/orders", "/devices", "/shop"],
  TECHNICIAN: ["/orders", "/catalog", "/salary", "/chats"],
  ADMIN: ["/orders", "/catalog", "/salary", "/admin"],
};

export const getNavigationGroupsForRole = (role: Role): NavigationGroup[] =>
  navigationGroups
    .map((group) => ({
      label: group.label,
      links: group.links.filter((link) => !link.roles || link.roles.includes(role)),
    }))
    .filter((group) => group.links.length > 0);

export const getPrimaryNavigationLinksForRole = (role: Role): NavigationLink[] => {
  const links = getNavigationGroupsForRole(role).flatMap((group) => group.links);
  return primaryRoutes[role].flatMap((route) => {
    const link = links.find((item) => item.to === route);
    return link ? [link] : [];
  });
};

export const isNavigationItemActive = (active: string, route: NavigationRoute): boolean => {
  if (active === route) return true;
  if (route === "/" || route === "/admin") return false;
  return active.startsWith(`${route}/`);
};
