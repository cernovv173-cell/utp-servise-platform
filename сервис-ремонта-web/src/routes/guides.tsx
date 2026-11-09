import { Outlet, createFileRoute } from "@tanstack/react-router";

const GuidesLayout = () => <Outlet />;

export const Route = createFileRoute("/guides")({ component: GuidesLayout });
