import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { OrderManagement } from "@/features/admin/order-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminRepairOrderPage = () => {
  const { user } = useAuth();
  const { orderId } = Route.useParams();

  return (
    <AppShell active="/admin/orders">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ СЕРВИСОМ"
        title="Карточка заявки на ремонт"
        description="Изменения, назначение мастера, услуги и переписка по выбранной заявке."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Карточка заявки доступна только администратору.
          </p>
          <Link
            to="/orders"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
          >
            Перейти к моим заявкам
          </Link>
        </SectionCard>
      ) : (
        <OrderManagement orderId={orderId} />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/orders/$orderId")({
  component: AdminRepairOrderPage,
});
