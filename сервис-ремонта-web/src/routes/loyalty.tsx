import { createFileRoute } from "@tanstack/react-router";
import { Info, Star } from "lucide-react";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

const LoyaltyPage = () => (
  <AppShell active="/loyalty">
    <PageTitle
      eyebrow="БОНУСЫ"
      title="Программа лояльности"
      description="Информация о бонусной программе UTP Servise."
    />
    <SectionCard className="max-w-3xl">
      <div className="flex items-start gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-600 dark:bg-amber-950">
          <Star fill="currentColor" />
        </span>
        <div>
          <h2 className="font-semibold">Баланс бонусов пока не рассчитывается</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
            Для начисления и списания бонусов нужно определить правила программы. В текущей версии
            сервера пока нет подтверждённых правил начисления, поэтому мы не показываем вымышленные
            баллы.
          </p>
          <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-400">
            <Info size={15} className="mt-0.5 shrink-0" />
            Ваши заявки и суммы работ доступны в разделе «Чеки и номера».
          </p>
        </div>
      </div>
    </SectionCard>
  </AppShell>
);
export const Route = createFileRoute("/loyalty")({ component: LoyaltyPage });
