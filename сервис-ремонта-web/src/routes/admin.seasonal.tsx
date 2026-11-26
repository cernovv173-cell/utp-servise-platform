import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { hasPermission } from "@/features/auth/staff-access";
import { SeasonalThemeControl } from "@/features/seasonal/seasonal-theme-control";

const AdminSeasonalPage = () => {
  const { token, user } = useAuth();

  return (
    <AppShell active="/admin/seasonal">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ СЕРВИСОМ"
        title="Сезонное оформление"
        description="Выберите, какой сезонный фон показывать на сайте и в Android-приложении."
      />
      {!hasPermission(user, "company_settings") ? (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Настройки сезонного оформления доступны только администратору.
          </p>
        </SectionCard>
      ) : token ? (
        <SeasonalThemeControl token={token} />
      ) : null}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/seasonal")({ component: AdminSeasonalPage });
