import { Link } from "@tanstack/react-router";
import { Cpu, ExternalLink } from "lucide-react";

import { RaccoonIcon } from "@/components/raccoon-icon";

import {
  type NavigationGroup,
  isNavigationItemActive,
} from "@/features/navigation/navigation-model";

export const DnsConfiguratorLink = ({ mobile = false }: { mobile?: boolean }) => (
  <a
    href="https://www.dns-shop.ru/configurator/"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Открыть конфигуратор ПК DNS в новой вкладке"
    className={
      mobile
        ? "flex min-h-11 items-center gap-3 rounded-md px-3 text-sm text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-slate-200 dark:hover:bg-slate-800"
        : "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:border-[#26365f] dark:hover:bg-[#101a34]"
    }
  >
    <Cpu size={mobile ? 17 : 18} aria-hidden="true" />
    <span>Конфигуратор ПК</span>
    <ExternalLink size={14} aria-hidden="true" />
  </a>
);

export const DesktopSectionNavigation = ({
  active,
  groups,
}: {
  active: string;
  groups: NavigationGroup[];
}) => (
  <nav
    aria-label="Разделы приложения"
    className="mt-5 min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain pr-1"
  >
    {groups.map((group) => (
      <div key={group.label}>
        <p className="px-3 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase dark:text-slate-500">
          {group.label}
        </p>
        <div className="mt-1 grid gap-1">
          {group.links.map(({ to, label, icon: Icon }) => {
            const isActive = isNavigationItemActive(active, to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-medium transition ${isActive ? "border-blue-100 bg-blue-50 text-blue-700 dark:border-[#405cc0]/50 dark:bg-[#17264b] dark:text-[#92eaff] dark:shadow-[inset_0_0_18px_rgba(77,120,255,0.12)]" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:border-[#26365f] dark:hover:bg-[#101a34]"}`}
              >
                <Icon size={18} aria-hidden="true" />
                <span className="min-w-0 truncate">{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    ))}
  </nav>
);

export const MobileSectionNavigation = ({
  active,
  groups,
}: {
  active: string;
  groups: NavigationGroup[];
}) => {
  const links = groups.flatMap((group) => group.links);

  return (
    <nav
      aria-label="Основные разделы"
      className="grid items-stretch gap-1 border-b border-slate-200 bg-white px-2 py-1.5 lg:hidden dark:border-[#26365f] dark:bg-[#080e20]"
      style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
    >
      {links.map(({ to, compactLabel, icon: Icon }) => {
        const isActive = isNavigationItemActive(active, to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center text-[10px] leading-tight font-medium transition ${isActive ? "bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-[#92eaff]" : "text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"}`}
          >
            <Icon size={17} aria-hidden="true" />
            <span className="w-full truncate">{compactLabel}</span>
          </Link>
        );
      })}
    </nav>
  );
};
