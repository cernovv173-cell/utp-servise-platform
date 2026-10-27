import { Link, useRouterState } from "@tanstack/react-router";

const links = [
  { to: "/offers", label: "Акции" },
  { to: "/loyalty", label: "Бонусы" },
  { to: "/reviews", label: "Отзывы" },
] as const;

export const BenefitsNavigation = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  return (
    <nav className="mb-5 flex flex-wrap gap-2" aria-label="Акции, бонусы и отзывы">
      {links.map((item) => {
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
