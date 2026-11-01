import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { AndroidApkManagement } from "@/features/admin/android-apk-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminApkPage = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Приложение (APK)"
        description="Загрузка и удаление Android-версии приложения, уведомление пользователей."
        action={<AdminBackLink />}
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500">Эта страница доступна только администратору.</p>
        </SectionCard>
      ) : (
        <AndroidApkManagement />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/apk")({ component: AdminApkPage });
