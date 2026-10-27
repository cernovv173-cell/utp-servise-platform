import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { OrderManagement } from "@/features/admin/order-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminOrdersPage = () => {
  const { user } = useAuth();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  if (pathname !== "/admin/orders") return <Outlet />;

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
        <OrderManagement />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/orders")({ component: AdminOrdersPage });
