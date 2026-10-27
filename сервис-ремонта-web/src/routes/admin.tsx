import { Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminSectionLinks } from "@/features/admin/admin-section-links";
import { AndroidApkManagement } from "@/features/admin/android-apk-management";
import { CompanyAdmin } from "@/features/admin/company-admin";
import { CustomerOffersManagement } from "@/features/admin/customer-offers-management";
import { LoyaltyManagement } from "@/features/admin/loyalty-management";
import { StaffManagement } from "@/features/admin/staff-management";
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
          <AndroidApkManagement />
          <CustomerOffersManagement />
          <StaffManagement />
          <LoyaltyManagement />
          <CompanyAdmin />
        </div>
      )}
    </AppShell>
  );
};
export const Route = createFileRoute("/admin")({ component: AdminPage });
