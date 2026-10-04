import { Archive, Inbox } from "lucide-react";

import type { OrderArchiveView } from "@/lib/api";

export const OrderArchiveTabs = ({
  value,
  onChange,
}: {
  value: OrderArchiveView;
  onChange: (value: OrderArchiveView) => void;
}) => (
  <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Активные заявки и архив">
    <button
      type="button"
      aria-pressed={value === "active"}
      onClick={() => onChange("active")}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${value === "active" ? "border-[#526fff] bg-[#eaf0ff] text-[#334fc4] dark:border-[#5675ff]/70 dark:bg-[#17264b] dark:text-[#91eaff] dark:shadow-[0_0_22px_rgba(78,116,255,0.14)]" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#293a65] dark:text-[#aab8d9] dark:hover:bg-[#101a34]"}`}
    >
      <Inbox size={16} aria-hidden="true" />
      Активные
    </button>
    <button
      type="button"
      aria-pressed={value === "archived"}
      onClick={() => onChange("archived")}
      className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition ${value === "archived" ? "border-[#526fff] bg-[#eaf0ff] text-[#334fc4] dark:border-[#5675ff]/70 dark:bg-[#17264b] dark:text-[#91eaff] dark:shadow-[0_0_22px_rgba(78,116,255,0.14)]" : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-[#293a65] dark:text-[#aab8d9] dark:hover:bg-[#101a34]"}`}
    >
      <Archive size={16} aria-hidden="true" />
      Архив
    </button>
  </div>
);
