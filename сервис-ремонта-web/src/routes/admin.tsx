import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminSectionLinks } from "@/features/admin/admin-section-links";
import { AdminToolLinks } from "@/features/admin/admin-tool-links";
import { useAuth } from "@/features/auth/auth-context";

const AdminPage = () => {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/admin") return <Outlet />;

  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Управление"
        description="Шесть рабочих разделов и административные инструменты сервиса."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-6">
          <AdminSectionLinks />
          <AdminToolLinks />
        </div>
      )}
    </AppShell>
  );
};
export const Route = createFileRoute("/admin")({ component: AdminPage });
