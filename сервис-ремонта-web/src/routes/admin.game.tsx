import { createFileRoute } from "@tanstack/react-router";

import { AppShell, SectionCard } from "@/components/app-shell";

import { AdminGameManagement } from "@/features/admin/admin-game-management";
import { useAuth } from "@/features/auth/auth-context";

const AdminGameRoute = () => {
  const { user } = useAuth();
  return (
    <AppShell active="/admin/game">
      {user?.role === "ADMIN" ? (
        <AdminGameManagement />
      ) : (
        <SectionCard className="max-w-xl">
          <h1 className="font-semibold">Раздел только для администратора</h1>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/game")({ component: AdminGameRoute });
