import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/uslugi/remont-telefonov")({
  beforeLoad: () => {
    throw redirect({ to: "/uslugi" });
  },
});
