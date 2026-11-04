import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/modal";
import { Select } from "@/components/select";

import {
  type RepairOrder,
  type RepairReceipt,
  getRepairOrderReleaseSummary,
  releaseRepairOrder,
} from "@/lib/api";

const paymentLabels: Record<NonNullable<RepairReceipt["paymentMethod"]>, string> = {
  CASH: "Наличные",
  CARD_TERMINAL: "Банковская карта",
  BANK_TRANSFER: "Перевод",
  OTHER: "Другой способ",
};

export const RepairOrderReleaseButton = ({
  order,
  token,
  onRefresh,
}: {
  order: RepairOrder;
  token: string;
  onRefresh: () => Promise<unknown>;
}) => {
  const [open, setOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] =
    useState<NonNullable<RepairReceipt["paymentMethod"]>>("CASH");
  const summary = useQuery({
    queryKey: ["repair-order-release-summary", token, order.id],
    queryFn: () => getRepairOrderReleaseSummary(token, order.id),
    enabled: open,
  });
  const release = useMutation({
    mutationFn: () => {
      if (!summary.data) throw new Error("Сначала загрузите сумму к оплате.");
      return releaseRepairOrder(token, order.id, {
        expectedAmountRub: summary.data.amountDueRub,
        ...(summary.data.amountDueRub > 0 && summary.data.paymentStatus !== "PAID"
          ? { paymentMethod }
          : {}),
      });
    },
    onSuccess: async () => {
      toast.success("Заказ выдан, оплата и гарантия сохранены.");
      setOpen(false);
      await onRefresh();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось выдать заказ."),
  });

  const close = (nextOpen: boolean) => {
    if (nextOpen) setPaymentMethod("CASH");
    setOpen(nextOpen);
  };
  const amount = summary.data?.amountDueRub ?? 0;
  const isAlreadyPaid = summary.data?.paymentStatus === "PAID";

  return (
    <Modal open={open} onOpenChange={close}>
      <button
        type="button"
        onClick={() => close(true)}
        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        <CheckCircle2 size={16} aria-hidden="true" />
        Выдать заказ
      </button>
      <ModalContent className="dark:border-slate-700 dark:bg-slate-900 dark:text-white">
        <ModalHeader>
          <ModalTitle>Выдать заказ · {order.serviceNumber}</ModalTitle>
          <ModalDescription className="dark:text-slate-400">
            Проверьте сумму и способ оплаты. После подтверждения заказ закроется, а чек и
            гарантийный талон будут сохранены.
          </ModalDescription>
        </ModalHeader>
        {summary.isLoading ? (
          <p className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> Проверяем сумму…
          </p>
        ) : summary.isError ? (
          <div className="grid gap-3 py-3">
            <p role="alert" className="text-sm text-rose-600">
              Не удалось получить сумму. Закройте окно и попробуйте ещё раз.
            </p>
            <button
              type="button"
              onClick={() => void summary.refetch()}
              className="min-h-10 w-fit rounded-lg border border-slate-200 px-3 text-sm font-semibold dark:border-slate-700"
            >
              Повторить
            </button>
          </div>
        ) : summary.data ? (
          <div className="grid gap-3 py-2">
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
              <p className="flex justify-between gap-3 text-sm">
                <span>Стоимость ремонта</span>
                <b>{summary.data.totalRub.toLocaleString("ru-RU")} ₽</b>
              </p>
              {summary.data.bonusDiscountRub > 0 && (
                <p className="mt-2 flex justify-between gap-3 text-sm text-emerald-700 dark:text-emerald-300">
                  <span>Списать бонусами</span>
                  <b>−{summary.data.bonusDiscountRub.toLocaleString("ru-RU")} ₽</b>
                </p>
              )}
              <p className="mt-3 flex justify-between gap-3 border-t border-slate-200 pt-3 text-base dark:border-slate-700">
                <span>К оплате</span>
                <b>{amount.toLocaleString("ru-RU")} ₽</b>
              </p>
            </div>
            {isAlreadyPaid ? (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Оплата уже отмечена
                {summary.data.paymentMethod ? `: ${paymentLabels[summary.data.paymentMethod]}` : ""}
                .
              </p>
            ) : amount > 0 ? (
              <Select
                ariaLabel="Способ оплаты"
                value={paymentMethod}
                onValueChange={(value) =>
                  setPaymentMethod(value as NonNullable<RepairReceipt["paymentMethod"]>)
                }
                options={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
            ) : (
              <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                Стоимость полностью покрывается выбранными бонусами.
              </p>
            )}
          </div>
        ) : null}
        <ModalFooter>
          <button
            type="button"
            onClick={() => close(false)}
            className="min-h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold dark:border-slate-700"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={!summary.data || summary.isFetching || release.isPending}
            onClick={() => release.mutate()}
            className="min-h-10 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            {release.isPending ? "Выдаём…" : "Подтвердить выдачу"}
          </button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
