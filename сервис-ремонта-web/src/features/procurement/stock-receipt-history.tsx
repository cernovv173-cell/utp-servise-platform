import { ClipboardList } from "lucide-react";

import { SectionCard } from "@/components/app-shell";

import type { StockReceipt } from "@/features/procurement/procurement-api";

const dateTime = new Intl.DateTimeFormat("ru-RU", {
  dateStyle: "medium",
  timeStyle: "short",
});
const rubles = new Intl.NumberFormat("ru-RU");

export const StockReceiptHistory = ({ receipts }: { receipts: StockReceipt[] }) => (
  <SectionCard>
    <div className="flex items-center gap-2">
      <ClipboardList size={18} className="text-slate-500" aria-hidden="true" />
      <h2 className="text-lg font-semibold">История поступлений</h2>
    </div>
    <p className="mt-1 text-sm text-slate-500">Последние 100 записей о поступлении на склад.</p>
    {receipts.length === 0 ? (
      <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 dark:bg-slate-900">
        Поступлений пока нет.
      </p>
    ) : (
      <ol className="mt-4 divide-y divide-slate-200 dark:divide-slate-800">
        {receipts.map((receipt) => (
          <li className="grid gap-1 py-3 sm:grid-cols-[1fr_auto] sm:gap-4" key={receipt.id}>
            <div className="min-w-0">
              <p className="font-medium">{receipt.itemNameSnapshot}</p>
              <p className="text-sm text-slate-500">
                {receipt.supplierNameSnapshot}
                {receipt.documentReference ? ` · ${receipt.documentReference}` : ""}
              </p>
            </div>
            <div className="sm:text-right">
              <p className="font-semibold">
                +{rubles.format(receipt.quantity)} шт.
                {receipt.unitCostRub === null
                  ? ""
                  : ` · ${rubles.format(receipt.unitCostRub)} ₽/шт.`}
              </p>
              <time className="text-xs text-slate-500" dateTime={receipt.receivedAt}>
                {dateTime.format(new Date(receipt.receivedAt))}
              </time>
            </div>
          </li>
        ))}
      </ol>
    )}
  </SectionCard>
);
