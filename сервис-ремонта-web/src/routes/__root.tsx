import { HeadContent, Link, Outlet, createRootRoute } from "@tanstack/react-router";
import { useState } from "react";

import { LaunchIntro } from "@/components/launch-intro";

import { AuthProvider } from "@/features/auth/auth-provider";

const RootComponent = () => {
  const [introDismissed, setIntroDismissed] = useState(false);

  return (
    <>
      <HeadContent />
      <AuthProvider>
        <Outlet />
        {!introDismissed && <LaunchIntro onClose={() => setIntroDismissed(true)} />}
      </AuthProvider>
    </>
  );
};

const RouteError = () => (
  <main className="grid min-h-dvh place-items-center px-6" id="main-content">
    <section className="max-w-md rounded-3xl border border-neutral-200 bg-white p-8 text-neutral-950 shadow-sm">
      <p className="font-mono text-xs tracking-widest text-red-700 uppercase">Application error</p>
      <h1 className="mt-3 text-3xl font-semibold">This view could not be opened.</h1>
      <p className="mt-3 text-sm leading-6 text-neutral-600">
        Return to the application root and try the action again.
      </p>
      <Link
        className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-neutral-950 px-4 text-sm font-semibold text-white"
        to="/"
      >
        Return home
      </Link>
    </section>
  </main>
);

const NotFound = () => (
  <main className="grid min-h-dvh place-items-center px-6" id="main-content">
    <section className="max-w-md text-center">
      <p className="font-mono text-sm text-neutral-600">404</p>
      <h1 className="mt-3 text-3xl font-semibold">Page not found</h1>
      <Link className="mt-6 inline-flex text-sm font-semibold text-neutral-950 underline" to="/">
        Return home
      </Link>
    </section>
  </main>
);

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RouteError,
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "UTP Servise — сервис ремонта техники" },
    ],
    links: [{ rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
  }),
  notFoundComponent: NotFound,
});
