import { Link } from "@tanstack/react-router";
import {
  Activity,
  CalendarDays,
  ChartNoAxesColumnIncreasing,
  type LucideIcon,
  Megaphone,
  Package,
  ShoppingBag,
  Users,
} from "lucide-react";

import { SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";

const managementSections: Array<{
  to:
    | "/admin/overview"
    | "/admin/schedule"
    | "/admin/customers"
    | "/admin/procurement"
    | "/admin/shop-orders"
    | "/admin/analytics"
    | "/advertising";
  title: string;
  description: string;
  icon: LucideIcon;
  permission: "customers" | "inventory" | "shop_orders" | "content" | "reports";
}> = [
  {
    to: "/admin/overview",
    title: "Обзор",
    description: "Сроки, нагрузка и итоги ремонта",
    icon: ChartNoAxesColumnIncreasing,
    permission: "reports",
  },
  {
    to: "/admin/analytics",
    title: "Аналитика",
    description: "Входы, регистрации и скачивания приложения",
    icon: Activity,
    permission: "reports",
  },
  {
    to: "/admin/schedule",
    title: "Расписание",
    description: "Заявки по времени и загрузка мастеров",
    icon: CalendarDays,
    permission: "reports",
  },
  {
    to: "/admin/customers",
    title: "Клиенты",
    description: "Поиск и управление клиентскими данными",
    icon: Users,
    permission: "customers",
  },
  {
    to: "/admin/procurement",
    title: "Склад",
    description: "Остатки, запчасти и список пополнения",
    icon: Package,
    permission: "inventory",
  },
  {
    to: "/admin/shop-orders",
    title: "Магазин",
    description: "Заказы товаров и выдача покупателям",
    icon: ShoppingBag,
    permission: "shop_orders",
  },
  {
    to: "/advertising",
    title: "Реклама",
    description: "Баннеры и промо-размещения",
    icon: Megaphone,
    permission: "content",
  },
];

export const AdminSectionLinks = () => {
  const { user } = useAuth();
  const availableSections = managementSections.filter(({ permission }) =>
    hasPermission(user, permission),
  );
  if (availableSections.length === 0) return null;

  return (
    <section aria-labelledby="admin-sections-title">
      <div className="mb-3">
        <h2 id="admin-sections-title" className="text-lg font-semibold">
          Разделы управления
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Показаны разделы, доступные по назначенным правам.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {availableSections.map(({ to, title, description, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="group block rounded-2xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
          >
            <SectionCard className="flex min-h-24 items-center gap-3 transition group-hover:-translate-y-0.5 group-hover:shadow-md">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-cyan-200">
                <Icon size={19} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold">{title}</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {description}
                </span>
              </span>
            </SectionCard>
          </Link>
        ))}
      </div>
    </section>
  );
};
