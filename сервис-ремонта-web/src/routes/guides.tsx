import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { GuidesIndexPage } from "@/features/guides/guides-index-page";

const GuidesRoute = () => {
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/guides" && pathname !== "/guides/") {
    return <Outlet />;
  }

  return <GuidesIndexPage />;
};

export const Route = createFileRoute("/guides")({ component: GuidesRoute });
