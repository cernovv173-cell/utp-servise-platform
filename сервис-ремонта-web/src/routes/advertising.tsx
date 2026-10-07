import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";
import { BannerManagement } from "@/features/admin/banner-management";
import { useAuth } from "@/features/auth/auth-context";

const AdvertisingPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/advertising">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Реклама"
        description="Создавайте рекламные баннеры и управляйте местами и сроками их показа."
      />
      {user?.role === "ADMIN" ? (
        <BannerManagement />
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-500">Этот раздел доступен только администратору.</p>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/advertising")({ component: AdvertisingPage });
