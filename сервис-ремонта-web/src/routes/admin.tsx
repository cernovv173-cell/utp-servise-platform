import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AndroidApkManagement } from "@/features/admin/android-apk-management";
import { CustomerOffersManagement } from "@/features/admin/customer-offers-management";
import { CompanyAdmin } from "@/features/admin/company-admin";
import { LoyaltyManagement } from "@/features/admin/loyalty-management";
import { StaffManagement } from "@/features/admin/staff-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Панель администратора"
        description="Заявки, новости, акции и розыгрыши, реклама, отзывы, бонусы и информация о компании."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-6">
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
