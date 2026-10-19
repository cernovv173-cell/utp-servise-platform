import { Link } from "@tanstack/react-router";
import { Cpu, ExternalLink, MoreHorizontal } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/dropdown-menu";
import { RaccoonIcon } from "@/components/raccoon-icon";

import {
  type NavigationGroup,
  getPrimaryNavigationLinksForRole,
  isNavigationItemActive,
} from "@/features/navigation/navigation-model";

import type { Role } from "@/lib/api";

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
    <ExternalLink size={mobile ? 14 : 14} aria-hidden="true" />
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
          {group.links.map(({ to, label, motion }) => {
            const isActive = isNavigationItemActive(active, to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl border px-3 text-sm font-medium transition ${isActive ? "border-blue-100 bg-blue-50 text-blue-700 dark:border-[#405cc0]/50 dark:bg-[#17264b] dark:text-[#92eaff] dark:shadow-[inset_0_0_18px_rgba(77,120,255,0.12)]" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:border-[#26365f] dark:hover:bg-[#101a34]"}`}
              >
                <RaccoonIcon motion={motion} className="size-[18px] text-base" />
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
  role,
}: {
  active: string;
  groups: NavigationGroup[];
  role: Role;
}) => {
  const primary = getPrimaryNavigationLinksForRole(role);
  const primaryRoutes = new Set(primary.map((link) => link.to));
  const secondaryGroups = groups
    .map((group) => ({
      ...group,
      links: group.links.filter((link) => !primaryRoutes.has(link.to)),
    }))
    .filter((group) => group.links.length > 0);
  const secondaryIsActive = secondaryGroups.some((group) =>
    group.links.some((link) => isNavigationItemActive(active, link.to)),
  );
  const primaryIsActive = primary.some((link) => isNavigationItemActive(active, link.to));

  return (
    <nav
      aria-label="Основные разделы"
      className="grid grid-cols-[repeat(4,minmax(0,1fr))_auto] items-stretch gap-1 border-b border-slate-200 bg-white px-2 py-1.5 lg:hidden dark:border-[#26365f] dark:bg-[#080e20]"
    >
      {primary.map(({ to, compactLabel, motion }) => {
        const isActive = isNavigationItemActive(active, to);
        return (
          <Link
            key={to}
            to={to}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center text-[10px] leading-tight font-medium transition ${isActive ? "bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-[#92eaff]" : "text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"}`}
          >
            <RaccoonIcon motion={motion} className="size-[16px] text-[15px]" />
            <span className="w-full truncate">{compactLabel}</span>
          </Link>
        );
      })}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Открыть все разделы"
            className={`flex min-w-14 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-[10px] leading-tight font-medium transition focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:outline-none ${secondaryIsActive && !primaryIsActive ? "bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-[#92eaff]" : "text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"}`}
          >
            <MoreHorizontal size={18} aria-hidden="true" />
            <span>Разделы</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="max-h-[70vh] w-72 max-w-[calc(100vw-1rem)] overflow-y-auto border-slate-200 bg-white text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <DropdownMenuLabel className="px-3 py-2 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">
            Все разделы
          </DropdownMenuLabel>
          {secondaryGroups.map((group) => (
            <DropdownMenuGroup key={group.label}>
              <DropdownMenuLabel className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {group.label}
              </DropdownMenuLabel>
              {group.links.map(({ to, label, motion }) => {
                const isActive = isNavigationItemActive(active, to);
                return (
                  <DropdownMenuItem
                    key={to}
                    asChild
                    className="min-h-11 p-0 text-slate-700 data-[highlighted]:bg-slate-100 dark:text-slate-200 dark:data-[highlighted]:bg-slate-800"
                  >
                    <Link
                      to={to}
                      aria-current={isActive ? "page" : undefined}
                      className={`flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm ${isActive ? "bg-blue-50 font-semibold text-blue-700 dark:bg-[#17264b] dark:text-[#92eaff]" : ""}`}
                    >
                      <RaccoonIcon motion={motion} className="size-[18px] text-base" />
                      <span className="min-w-0 flex-1 truncate">{label}</span>
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator className="my-1 bg-slate-200 dark:bg-slate-700" />
            </DropdownMenuGroup>
          ))}
          <DropdownMenuItem
            asChild
            className="min-h-11 p-0 text-slate-700 data-[highlighted]:bg-slate-100 dark:text-slate-200 dark:data-[highlighted]:bg-slate-800"
          >
            <a
              href="https://www.dns-shop.ru/configurator/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 w-full items-center gap-3 rounded-md px-3 text-sm"
            >
              <Cpu size={17} aria-hidden="true" />
              <span className="flex-1">Конфигуратор ПК</span>
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
};
