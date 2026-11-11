import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export const PreviewNotice = () => (
  <div className="flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
    <CircleAlert className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
    <p>
      <strong>Предпросмотр сценария.</strong> Все действия демонстрационные: данные остаются только
      на этой странице, настоящая заявка не отправляется.
    </p>
  </div>
);

export const PreviewChoiceButton = ({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${active ? "border-blue-600 bg-blue-50 text-blue-800 dark:border-sky-400 dark:bg-sky-950/50 dark:text-sky-100" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
  >
    {children}
  </button>
);

export const PreviewSummaryLine = ({ label, value }: { label: string; value: string }) => (
  <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0 dark:border-slate-800">
    <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
    <span className="text-right text-sm font-semibold">{value}</span>
  </div>
);
