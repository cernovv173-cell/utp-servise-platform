import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { CatalogVisibilityControl } from "@/features/admin/catalog-visibility-control";
import { ClosureAnnouncementControl } from "@/features/admin/closure-announcement-control";
import { CompanyAdmin } from "@/features/admin/company-admin";
import { RepairOrderIntakeControl } from "@/features/admin/repair-order-intake-control";
import { useAuth } from "@/features/auth/auth-context";

const AdminCompanyPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="О компании"
        description="Текст и данные раздела «О компании» на сайте."
        action={<AdminBackLink />}
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4">
          <RepairOrderIntakeControl />
          <CatalogVisibilityControl />
          <ClosureAnnouncementControl />
          <CompanyAdmin />
        </div>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/company")({ component: AdminCompanyPage });
