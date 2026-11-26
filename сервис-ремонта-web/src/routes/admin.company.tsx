import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { CatalogVisibilityControl } from "@/features/admin/catalog-visibility-control";
import { ClosureAnnouncementControl } from "@/features/admin/closure-announcement-control";
import { CompanyAdmin } from "@/features/admin/company-admin";
import { FlowingFireSettingsControl } from "@/features/admin/flowing-fire-settings-control";
import { RepairOrderIntakeControl } from "@/features/admin/repair-order-intake-control";
import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";

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
      {!hasPermission(user, "company_settings") ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-4">
          <RepairOrderIntakeControl />
          <CatalogVisibilityControl />
          <ClosureAnnouncementControl />
          <FlowingFireSettingsControl />
          <CompanyAdmin />
        </div>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/company")({ component: AdminCompanyPage });
