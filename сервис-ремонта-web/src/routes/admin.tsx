import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AndroidApkManagement } from "@/features/admin/android-apk-management";
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
        description="Заявки, новости по расписанию, реклама, отзывы, бонусы и публичная информация о компании."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-6">
          <AndroidApkManagement />
          <SectionCard>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="font-semibold">Заявки на ремонт</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Откройте общий список и управляйте статусом, сроком, мастером и данными каждой
                  заявки отдельно.
                </p>
              </div>
              <Link
                to="/admin/orders"
                className="inline-flex min-h-10 items-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Открыть заявки
              </Link>
            </div>
          </SectionCard>
          <StaffManagement />
          <LoyaltyManagement />
          <CompanyAdmin />
        </div>
      )}
    </AppShell>
  );
};
export const Route = createFileRoute("/admin")({ component: AdminPage });
