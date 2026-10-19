import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { ShopOrdersManagement } from "@/features/shop/shop-orders-management";

const AdminShopOrdersPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin/shop-orders">
      <PageTitle
        eyebrow="МАГАЗИН"
        title="Подтверждение заказов магазина"
        description="Сначала проверьте наличие и подтвердите заказ. После этого администратор отметит выдачу; оплату и получение согласуйте с клиентом отдельно."
      />
      {user?.role === "ADMIN" ? (
        <ShopOrdersManagement />
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/shop-orders")({ component: AdminShopOrdersPage });
