import { Link } from "@tanstack/react-router";
import { ChevronDown, Cpu, ExternalLink, LifeBuoy, type LucideIcon } from "lucide-react";
import { useState } from "react";

import {
  type HelpNavigationLink,
  type HelpRoute,
  type NavigationGroup,
  type NavigationRoute,
  isNavigationItemActive,
} from "@/features/navigation/navigation-model";

type SectionNavigationItem = {
  to: NavigationRoute | HelpRoute;
  label: string;
  icon: LucideIcon;
};

const DesktopNavigationLink = ({
  active,
  item,
  dense = false,
}: {
  active: string;
  item: SectionNavigationItem;
  dense?: boolean;
}) => {
  const isActive = isNavigationItemActive(active, item.to);
  const Icon = item.icon;

  return (
    <Link
      to={item.to}
      title={dense ? item.label : undefined}
      aria-current={isActive ? "page" : undefined}
      className={`flex items-center rounded-xl border font-medium transition ${dense ? "min-h-10 gap-2.5 px-2 text-[13px]" : "min-h-11 gap-3 px-3 text-sm"} ${isActive ? "border-blue-100 bg-blue-50 text-blue-700 dark:border-[#405cc0]/50 dark:bg-[#17264b] dark:text-[#92eaff] dark:shadow-[inset_0_0_18px_rgba(77,120,255,0.12)]" : "border-transparent text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:border-[#26365f] dark:hover:bg-[#101a34]"}`}
    >
      <Icon size={dense ? 16 : 18} aria-hidden="true" />
      <span className="min-w-0 truncate">{item.label}</span>
    </Link>
  );
};

const DesktopHelpNavigation = ({
  active,
  links,
}: {
  active: string;
  links: HelpNavigationLink[];
}) => {
  const [open, setOpen] = useState(true);

  if (links.length === 0) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-1 dark:border-[#26365f] dark:bg-[#0b1530]/80">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="sidebar-help-links"
        className="flex min-h-9 w-full items-center gap-2 rounded-xl px-2 text-left text-[13px] font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-[#c9d7f7] dark:hover:bg-[#101a34]"
      >
        <LifeBuoy size={16} aria-hidden="true" className="text-blue-600 dark:text-[#77e7ff]" />
        <span className="min-w-0 flex-1 truncate">Помощь</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div id="sidebar-help-links" className="mt-1 grid gap-1">
          {links.map((link) => (
            <DesktopNavigationLink key={link.to} active={active} item={link} dense />
          ))}
        </div>
      )}
    </div>
  );
};

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
  helpLinks = [],
}: {
  active: string;
  groups: NavigationGroup[];
  helpLinks?: HelpNavigationLink[];
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
          {group.links.map((link) => (
            <DesktopNavigationLink key={link.to} active={active} item={link} />
          ))}
        </div>
      </div>
    ))}
    <DesktopHelpNavigation active={active} links={helpLinks} />
  </nav>
);

export const MobileSectionNavigation = ({
  active,
  groups,
  helpLinks = [],
}: {
  active: string;
  groups: NavigationGroup[];
  helpLinks?: HelpNavigationLink[];
}) => {
  const links = groups.flatMap((group) => group.links);

  return (
    <div className="lg:hidden">
      <nav
        aria-label="Основные разделы"
        className="grid items-stretch gap-1 border-b border-slate-200 bg-white px-2 py-1.5 dark:border-[#26365f] dark:bg-[#080e20]"
        style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}
      >
        {links.map(({ to, compactLabel, icon: Icon }) => {
          const isActive = isNavigationItemActive(active, to);
          return (
            <Link
              key={to}
              to={to}
              aria-current={isActive ? "page" : undefined}
              className={`flex min-h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 text-center text-[11px] leading-tight font-medium transition ${isActive ? "bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-[#92eaff]" : "text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"}`}
            >
              <Icon size={17} aria-hidden="true" />
              <span className="w-full truncate">{compactLabel}</span>
            </Link>
          );
        })}
      </nav>
      {helpLinks.length > 0 && (
        <nav
          aria-label="Помощь"
          className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 bg-white px-3 py-1.5 dark:border-[#26365f] dark:bg-[#080e20]"
        >
          <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[11px] font-semibold tracking-[0.12em] text-slate-400 uppercase dark:text-slate-500">
            <LifeBuoy size={14} aria-hidden="true" />
            Помощь
          </span>
          {helpLinks.map(({ to, compactLabel, icon: Icon }) => {
            const isActive = isNavigationItemActive(active, to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={isActive ? "page" : undefined}
                className={`flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${isActive ? "bg-blue-50 text-blue-700 dark:bg-[#17264b] dark:text-[#92eaff]" : "text-slate-600 hover:bg-slate-100 dark:text-[#a8b5d4] dark:hover:bg-[#101a34]"}`}
              >
                <Icon size={15} aria-hidden="true" />
                <span>{compactLabel}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
};
