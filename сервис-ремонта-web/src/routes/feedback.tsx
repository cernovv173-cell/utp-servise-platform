import { createFileRoute } from "@tanstack/react-router";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { CustomerFeedbackForm } from "@/features/feedback/customer-feedback-form";

const CustomerFeedbackPage = () => {
  const { user } = useAuth();

  return (
    <AppShell active="/feedback">
      <PageTitle
        eyebrow="ОБРАТНАЯ СВЯЗЬ"
        title="Жалобы и предложения"
        description="Сообщите нам о проблеме или поделитесь идеей для сервиса."
      />
      {user?.role === "CUSTOMER" ? (
        <CustomerFeedbackForm />
      ) : (
        <SectionCard>
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Отправить жалобу или предложение могут клиенты, вошедшие в свой аккаунт.
          </p>
        </SectionCard>
      )}
    </AppShell>
  );
};

export const Route = createFileRoute("/feedback")({ component: CustomerFeedbackPage });
