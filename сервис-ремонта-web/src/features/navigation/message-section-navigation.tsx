import { Link, useRouterState } from "@tanstack/react-router";

const links = [
  { to: "/chats", label: "Чаты по заявкам" },
  { to: "/support", label: "Поддержка" },
] as const;

export const MessageSectionNavigation = ({
  canOpenSupport = true,
}: {
  canOpenSupport?: boolean;
}) => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const visibleLinks = canOpenSupport ? links : links.slice(0, 1);

  return (
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Сообщения и поддержка">
      {visibleLinks.map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            aria-current={active ? "page" : undefined}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              active
                ? "bg-blue-600 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
};
