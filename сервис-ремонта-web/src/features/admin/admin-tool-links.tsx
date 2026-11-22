import { Link } from "@tanstack/react-router";
import {
  Building2,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Gift,
  type LucideIcon,
  MessageSquareText,
  Smartphone,
  Tag,
  UserCog,
} from "lucide-react";

import { SectionCard } from "@/components/app-shell";

const adminTools: Array<{
  to:
    | "/admin/apk"
    | "/admin/offers"
    | "/admin/staff"
    | "/admin/loyalty"
    | "/admin/company"
    | "/admin/feedback"
    | "/admin/salary-reports"
    | "/news";
  title: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    to: "/admin/apk",
    title: "Приложение (APK)",
    description: "Android-версия и уведомления клиентов",
    icon: Smartphone,
  },
  {
    to: "/admin/offers",
    title: "Предложения клиентам",
    description: "Акции, розыгрыши и результаты",
    icon: Tag,
  },
  {
    to: "/news",
    title: "Новости и примеры работ",
    description: "Публикации сервиса и истории выполненных работ",
    icon: FileText,
  },
  {
    to: "/admin/staff",
    title: "Сотрудники",
    description: "Список сотрудников и учётные записи",
    icon: UserCog,
  },
  {
    to: "/admin/loyalty",
    title: "Бонусы клиентов",
    description: "Балансы и последние начисления",
    icon: Gift,
  },
  {
    to: "/admin/company",
    title: "О компании",
    description: "Раздел «О компании» на сайте",
    icon: Building2,
  },
  {
    to: "/admin/feedback",
    title: "Жалобы и предложения",
    description: "Входящие сообщения клиентов и их статусы",
    icon: MessageSquareText,
  },
  {
    to: "/admin/salary-reports",
    title: "Отчёты по зарплате",
    description: "Ежемесячные начисления мастерам в XLSX",
    icon: FileSpreadsheet,
  },
];

export const AdminToolLinks = () => (
  <section aria-labelledby="admin-tools-title">
    <div className="mb-3">
      <h2 id="admin-tools-title" className="text-lg font-semibold">
        Служебные инструменты
      </h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        Каждый инструмент открывается на отдельной странице.
      </p>
    </div>
    <SectionCard>
      <ul className="-my-3 divide-y divide-slate-100 dark:divide-slate-800">
        {adminTools.map(({ to, title, description, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="group flex items-center gap-3 rounded-lg py-3 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-cyan-200">
                <Icon size={18} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold group-hover:text-blue-700 dark:group-hover:text-cyan-200">
                  {title}
                </span>
                <span className="block truncate text-xs text-slate-500 dark:text-slate-400">
                  {description}
                </span>
              </span>
              <ChevronRight
                size={18}
                aria-hidden="true"
                className="shrink-0 text-slate-400 transition group-hover:translate-x-0.5"
              />
            </Link>
          </li>
        ))}
      </ul>
    </SectionCard>
  </section>
);
