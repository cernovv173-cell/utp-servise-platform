import { ShieldCheck, Wrench } from "lucide-react";

import { buildRepairCompletionCardContent } from "@/features/orders/repair-completion-card-content";
import { RepairOrderReviewForm } from "@/features/orders/repair-order-review-form";

import type { RepairOrder } from "@/lib/api";

export const RepairCompletionCard = ({ order }: { order: RepairOrder }) => {
  const content = buildRepairCompletionCardContent(order);

  return (
    <section
      aria-labelledby={`repair-completion-${order.id}`}
      className="mt-4 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-4 dark:border-emerald-900/60 dark:from-emerald-950/50 dark:via-slate-900 dark:to-amber-950/30"
    >
      <div className="flex items-center gap-3">
        <img
          src="/images/raccoon-computer-mascot.jpg"
          alt="Енот — талисман сервиса"
          className="size-20 shrink-0 rounded-2xl object-cover shadow-sm"
        />
        <div>
          <p className="text-xs font-semibold tracking-wide text-emerald-700 uppercase dark:text-emerald-300">
            Ремонт завершён
          </p>
          <h3 id={`repair-completion-${order.id}`} className="mt-1 text-lg font-bold">
            Техника снова в строю!
          </h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            Енот поздравляет вас с завершением ремонта.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-950/50">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Wrench size={16} aria-hidden="true" /> Выполненные работы
          </p>
          <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">{content.repairSummary}</p>
        </div>
        <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-950/50">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <ShieldCheck size={16} aria-hidden="true" /> Гарантия
          </p>
          {content.warrantyNumber ? (
            <>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                Талон {content.warrantyNumber} · {content.warrantyDuration}
              </p>
              {content.warrantyTerms && (
                <p className="mt-1 text-xs whitespace-pre-wrap text-slate-600 dark:text-slate-300">
                  {content.warrantyTerms}
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
              Информация о гарантии в заказе не указана.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4">
        {order.review ? (
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
            Спасибо! Ваш отзыв уже отправлен.
          </p>
        ) : (
          <RepairOrderReviewForm orderId={order.id} serviceNumber={order.serviceNumber} />
        )}
      </div>
    </section>
  );
};
