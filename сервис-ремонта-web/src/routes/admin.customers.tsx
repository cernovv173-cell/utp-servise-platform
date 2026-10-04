import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { CustomerManagement } from "@/features/admin/customer-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminCustomersPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin/customers">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ СЕРВИСОМ"
        title="База клиентов"
        description="Создавайте учётные записи клиентов и обновляйте их контакты для заявок."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            База доступна только администратору.
          </p>
          <Link to="/" className="mt-3 inline-flex text-sm font-medium text-blue-600">
            На главную
          </Link>
        </SectionCard>
      ) : (
        <CustomerManagement />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/customers")({ component: AdminCustomersPage });
