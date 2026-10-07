import { Gift } from "lucide-react";
import { useEffect, useState } from "react";

import { SectionCard } from "@/components/app-shell";

import type { PersonalBirthdayGreeting } from "@/lib/api";

type BirthdayGreetingCardProps = {
  greeting: PersonalBirthdayGreeting;
};

const formatMoscowDateTime = (value: string) =>
  new Intl.DateTimeFormat("ru-RU", {
    timeZone: "Europe/Moscow",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

export const BirthdayGreetingCard = ({ greeting }: BirthdayGreetingCardProps) => {
  const [expiredAt, setExpiredAt] = useState<string | null>(null);

  useEffect(() => {
    const millisecondsUntilExpiry = Math.max(0, new Date(greeting.endsAt).getTime() - Date.now());
    const timer = window.setTimeout(() => setExpiredAt(greeting.endsAt), millisecondsUntilExpiry);
    return () => window.clearTimeout(timer);
  }, [greeting.endsAt]);

  if (expiredAt === greeting.endsAt) return null;

  return (
    <SectionCard className="mb-5 border-amber-200 bg-gradient-to-br from-amber-50 to-rose-50 dark:border-amber-900 dark:from-amber-950/50 dark:to-rose-950/30">
      <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-200">
        <Gift size={18} aria-hidden="true" />
        Личное поздравление
      </div>
      <h2 className="mt-3 text-lg font-semibold">{greeting.title}</h2>
      <p className="mt-2 text-sm leading-6 whitespace-pre-line text-slate-700 dark:text-slate-200">
        {greeting.content}
      </p>
      <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
        Доступно только вам до {formatMoscowDateTime(greeting.endsAt)} по Москве.
      </p>
    </SectionCard>
  );
};
