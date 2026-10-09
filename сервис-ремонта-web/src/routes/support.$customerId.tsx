import { Link, createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { SupportChatConversation } from "@/features/support/support-chat-conversation";

const AdminSupportConversationPage = () => {
  const { user } = useAuth();
  const { customerId } = Route.useParams();

  return (
    <AppShell active="/support">
      <PageTitle
        eyebrow="ПОДДЕРЖКА КЛИЕНТОВ"
        title="Обращение клиента"
        description="Личная переписка клиента с администрацией сервиса."
        action={
          <Link
            to="/support"
            className="inline-flex min-h-10 items-center rounded-lg border border-slate-200 px-4 text-sm font-medium dark:border-slate-700"
          >
            ← К обращениям
          </Link>
        }
      />
      {user?.role === "ADMIN" ? (
        <SupportChatConversation customerId={customerId} />
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Эта переписка доступна только администратору.
          </p>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/support/$customerId")({
  component: AdminSupportConversationPage,
});
