import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { OrderManagement } from "@/features/admin/order-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminOrderEditingPage = () => {
  const { user } = useAuth();

  return (
    <AppShell active="/admin/order-editing">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ СЕРВИСОМ"
        title="Редактирование заявок на ремонт"
        description="Выберите заявку в списке и нажмите «Редактировать». Данные и состав заказа сохраняются с учётом статуса, склада и оплаты."
        action={
          <Link
            to="/admin/orders"
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
          >
            К списку заявок
          </Link>
        }
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Редактирование заявок доступно только администратору.
          </p>
          <Link
            to="/orders"
            className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
          >
            Перейти к своим заявкам
          </Link>
        </SectionCard>
      ) : (
        <OrderManagement editingWorkspace />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/order-editing")({
  component: AdminOrderEditingPage,
});
