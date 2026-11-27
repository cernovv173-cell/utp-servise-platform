import { createFileRoute, redirect } from "@tanstack/react-router";

import { getPublicAuthRequestFromSearch } from "@/features/auth/public-auth-entry";

export const Route = createFileRoute("/login")({
  beforeLoad: ({ location }) => {
    const request = getPublicAuthRequestFromSearch(location.searchStr) ?? {
      intent: "login" as const,
      nextPath: "/",
    };
    const referralCode = new URLSearchParams(location.searchStr).get("ref")?.trim();

    throw redirect({
      to: "/",
      search: {
        auth: request.intent,
        next: request.nextPath,
        ...(referralCode ? { ref: referralCode } : {}),
      },
      replace: true,
    });
  },
});
