import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { AnalyticsDashboard } from "@/features/admin/analytics-dashboard";
import { useAuth } from "@/features/auth/auth-context";

const AdminAnalyticsPage = () => {
  const { user } = useAuth();

  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Аналитика"
        description="Успешные входы, регистрации и скачивания Android-приложения."
        action={<AdminBackLink />}
      />
      {user?.role !== "ADMIN" ? (
        <SectionCard>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Эта страница доступна только администратору.
          </p>
        </SectionCard>
      ) : (
        <AnalyticsDashboard />
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/analytics")({ component: AdminAnalyticsPage });
