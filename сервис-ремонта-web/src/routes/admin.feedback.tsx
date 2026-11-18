import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminBackLink } from "@/features/admin/admin-back-link";
import { AdminFeedbackInbox } from "@/features/admin/admin-feedback-inbox";
import { useAuth } from "@/features/auth/auth-context";

const AdminFeedbackPage = () => {
  const { user } = useAuth();

  return (
    <AppShell active="/admin">
      <PageTitle
        eyebrow="УПРАВЛЕНИЕ"
        title="Жалобы и предложения"
        description="Личные сообщения клиентов и обработка их статусов."
        action={<AdminBackLink />}
      />
      {user?.role === "ADMIN" ? (
        <AdminFeedbackInbox />
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-500">Этот список доступен только администратору.</p>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/admin/feedback")({ component: AdminFeedbackPage });
