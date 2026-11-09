import { Outlet, createFileRoute } from "@tanstack/react-router";

const ServicesLayout = () => <Outlet />;

export const Route = createFileRoute("/uslugi")({ component: ServicesLayout });
