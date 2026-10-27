import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { AdminSupportInbox } from "@/features/admin/admin-support-inbox";
import { useAuth } from "@/features/auth/auth-context";
import { MessageSectionNavigation } from "@/features/navigation/message-section-navigation";
import { SupportChatConversation } from "@/features/support/support-chat-conversation";

const SupportPage = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.role === "ADMIN";
  const isCustomer = user?.role === "CUSTOMER";

  return (
    <AppShell active="/support">
      {(isAdmin || isCustomer) && <MessageSectionNavigation />}
      <PageTitle
        eyebrow="ПОМОЩЬ"
        title={isAdmin ? "Поддержка клиентов" : "Поддержка"}
        description={
          isAdmin
            ? "Очередь личных обращений клиентов. Выберите беседу, чтобы ответить."
            : "Задайте вопрос администратору. Переписка доступна только вам и сотрудникам поддержки."
        }
      />
      {isAdmin && <AdminSupportInbox />}
      {isCustomer && token && <SupportChatConversation />}
      {!isAdmin && !isCustomer && (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Обращения в поддержку доступны клиентам и администраторам.
          </p>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/support")({ component: SupportPage });
