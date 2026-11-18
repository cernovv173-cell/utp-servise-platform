import { ChevronDown } from "lucide-react";

import type { RepairOrder } from "@/lib/api";

const deviceLabels: Record<string, string> = {
  COMPUTER: "ПК",
  LAPTOP: "Ноутбук",
  MONOBLOCK: "Моноблок",
  PHONE: "Телефон",
  TABLET: "Планшет",
};

export const RepairOrderDisclosureSummary = ({
  order,
  statusLabel,
  customerName,
}: {
  order: RepairOrder;
  statusLabel: string;
  customerName?: string;
}) => {
  const deviceLabel = deviceLabels[order.deviceType] ?? order.deviceType;
  const deviceDescription = [order.deviceBrand, order.deviceModel]
    .filter((part): part is string => Boolean(part?.trim()))
    .join(" ");

  return (
    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-xs font-semibold text-blue-600 dark:text-blue-300">
            {order.serviceNumber}
          </span>
          {order.archivedAt && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-semibold text-violet-800 dark:bg-[#241b45] dark:text-[#d4c4ff]">
              Архив
            </span>
          )}
        </div>
        <p className="mt-1 truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
          {customerName ? `${customerName} · ` : ""}
          {deviceLabel}
          {deviceDescription ? ` · ${deviceDescription}` : ""}
        </p>
        <p className="mt-1 line-clamp-2 text-xs text-slate-500 dark:text-slate-400">
          {order.problem}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
          {statusLabel}
        </span>
        <span className="text-[10px] text-slate-400">
          {new Date(order.createdAt).toLocaleDateString("ru-RU")}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-300">
          Подробности
          <ChevronDown size={14} aria-hidden="true" />
        </span>
      </div>
    </summary>
  );
};
