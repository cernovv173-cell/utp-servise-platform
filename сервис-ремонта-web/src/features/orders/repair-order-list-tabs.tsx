import { Archive, ClipboardList, History } from "lucide-react";

import type { OrderListView } from "./order-list-view";

const views: Array<{ id: OrderListView; label: string; icon: typeof ClipboardList }> = [
  { id: "active", label: "Активные", icon: ClipboardList },
  { id: "history", label: "История ремонтов", icon: History },
  { id: "archived", label: "Архив", icon: Archive },
];

export const RepairOrderListTabs = ({
  value,
  onChange,
}: {
  value: OrderListView;
  onChange: (value: OrderListView) => void;
}) => (
  <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Заявки и история ремонтов">
    {views.map(({ id, label, icon: Icon }) => (
      <button
        key={id}
        type="button"
        aria-pressed={value === id}
        onClick={() => onChange(id)}
        className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${value === id ? "border-[#526fff] bg-[#eaf0ff] text-[#334fc4] dark:border-[#5675ff]/70 dark:bg-[#17264b] dark:text-[#91eaff]" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#293a65] dark:text-[#aab8d9] dark:hover:bg-[#101a34]"}`}
      >
        <Icon size={16} aria-hidden="true" />
        {label}
      </button>
    ))}
  </div>
);
