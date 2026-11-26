import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { StaffManagement } from "@/features/admin/staff-management";
import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";

const AdminStaffPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Сотрудники"
        description="Список сотрудников, добавление новых и удаление учётных записей."
        action={<AdminBackLink />}
      />
      {!hasPermission(user, "staff_management") ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <StaffManagement />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/staff")({ component: AdminStaffPage });
