import { Link, createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AndroidApkManagement } from "@/features/admin/android-apk-management";
import { CompanyAdmin } from "@/features/admin/company-admin";
import { CustomerOffersManagement } from "@/features/admin/customer-offers-management";
import { LoyaltyManagement } from "@/features/admin/loyalty-management";
import { StaffManagement } from "@/features/admin/staff-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Панель администратора"
        description="Заявки, новости, акции и розыгрыши, реклама, отзывы, бонусы и информация о компании."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <div className="grid gap-6">
          <Link to="/admin/shop-orders">
            <SectionCard className="flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-md">
              <span className="grid size-11 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                <ShoppingBag size={22} aria-hidden="true" />
              </span>
              <span>
                <span className="block font-semibold">Подтверждение заказов магазина</span>
                <span className="mt-1 block text-sm text-slate-500">
                  Отдельная очередь проверки наличия и дальнейшей выдачи
                </span>
              </span>
            </SectionCard>
          </Link>
          <AndroidApkManagement />
          <CustomerOffersManagement />
          <StaffManagement />
          <LoyaltyManagement />
          <CompanyAdmin />
        </div>
      )}
    </AppShell>
  );
};
export const Route = createFileRoute("/admin")({ component: AdminPage });
