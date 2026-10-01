import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { CompanyAdmin } from "@/features/admin/company-admin";
import { NewsAdmin } from "@/features/admin/news-admin";
import { useAuth } from "@/features/auth/auth-context";

const AdminPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Панель администратора"
        description="Публикуйте новости по расписанию и обновляйте публичную информацию о компании."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-6">
          <NewsAdmin />
          <CompanyAdmin />
        </div>
      )}
    </AppShell>
  );
};
export const Route = createFileRoute("/admin")({ component: AdminPage });
