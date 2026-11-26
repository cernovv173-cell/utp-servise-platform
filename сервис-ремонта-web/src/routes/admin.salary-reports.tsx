import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { MonthlySalaryReports } from "@/features/admin/monthly-salary-reports";
import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";

const AdminSalaryReportsPage = () => {
  const { user } = useAuth();

  return (
    <AppShell active="/admin/salary-reports">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Отчёты по зарплате"
        description="Месячные Excel-отчёты о работах и начислениях каждого мастера."
        action={<AdminBackLink />}
      />
      {!hasPermission(user, "reports") ? (
        <SectionCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Эта страница доступна только администратору.
          </p>
        </SectionCard>
      ) : (
        <MonthlySalaryReports />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/salary-reports")({
  component: AdminSalaryReportsPage,
});
