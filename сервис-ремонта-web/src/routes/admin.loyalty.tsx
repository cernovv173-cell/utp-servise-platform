import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { LoyaltyManagement } from "@/features/admin/loyalty-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminLoyaltyPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Бонусы клиентов"
        description="Бонусные балансы клиентов, последние начисления и списания."
        action={<AdminBackLink />}
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <LoyaltyManagement />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/loyalty")({ component: AdminLoyaltyPage });
