import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { BannerManagement } from "@/features/admin/banner-management";
import { CompanyAdmin } from "@/features/admin/company-admin";
import { LoyaltyManagement } from "@/features/admin/loyalty-management";
import { NewsAdmin } from "@/features/admin/news-admin";
import { OrderManagement } from "@/features/admin/order-management";
import { ReviewManagement } from "@/features/admin/review-management";
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
          <NewsAdmin />
          <OrderManagement />
          <ReviewManagement />
          <LoyaltyManagement />
          <BannerManagement />
          <CompanyAdmin />
        </div>
      )}
    </AppShell>
  );
};
export const Route = createFileRoute("/admin")({ component: AdminPage });
