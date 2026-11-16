import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { CustomerOffersManagement } from "@/features/admin/customer-offers-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminOffersPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Предложения клиентам"
        description="Акции и розыгрыши для клиентов, призовые места и результаты."
        action={<AdminBackLink />}
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <CustomerOffersManagement />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/offers")({ component: AdminOffersPage });
