import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { OrderManagement } from "@/features/admin/order-management";
import { useAuth } from "@/features/auth/auth-context";
import { type OrderListView, isOrderListView } from "@/features/orders/order-list-view";

const AdminOrdersPage = () => {
  const { user } = useAuth();
  const { view } = Route.useSearch();

  return (
    <AppShell active="/admin/orders">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ СЕРВИСОМ"
        title="Заявки на ремонт"
        description="Общий список заявок. Все действия применяются только к выбранной карточке заказа."
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Управление заявками доступно только администратору.
          </p>
          <Link
            to="/orders"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
          >
            Перейти к моим заявкам
          </Link>
        </SectionCard>
      ) : (
        <OrderManagement initialView={view ?? "active"} />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/orders")({
  validateSearch: (search: Record<string, unknown>): { view?: OrderListView } =>
    isOrderListView(search.view) ? { view: search.view } : {},
  component: AdminOrdersPage,
});
