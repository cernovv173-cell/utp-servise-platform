import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppShell, PageTitle, SectionCard } from "@/components/app-shell";

import { useAuth } from "@/features/auth/auth-context";
import { repairDeviceTypeLabel } from "@/features/catalog/catalog-model";
import { ReceiptDraftEditor } from "@/features/checks/receipt-draft-editor";

import {
  type ReceiptDraft,
  type RepairReceipt,
  createRepairReceipt,
  getOrders,
  markReceiptPaid,
  requestBonusRedemption,
} from "@/lib/api";

const paymentLabels: Record<NonNullable<RepairReceipt["paymentMethod"]>, string> = {
  CASH: "Наличные",
  CARD_TERMINAL: "Карта через терминал",
  BANK_TRANSFER: "Банковский перевод",
  OTHER: "Другое",
};

const ChecksPage = () => {
  const { token, user } = useAuth();
  const client = useQueryClient();
  const [paymentMethods, setPaymentMethods] = useState<
    Record<string, NonNullable<RepairReceipt["paymentMethod"]>>
  >({});
  const [printingOrderId, setPrintingOrderId] = useState<string | null>(null);
  useEffect(() => {
    if (!printingOrderId) return;
    const finishPrint = () => setPrintingOrderId(null);
    const printFrame = window.setTimeout(() => window.print(), 0);
    window.addEventListener("afterprint", finishPrint);
    return () => {
      window.clearTimeout(printFrame);
      window.removeEventListener("afterprint", finishPrint);
      document.body.classList.remove("print-single-receipt");
    };
  }, [printingOrderId]);
  const query = useQuery({
    queryKey: ["orders", token],
    queryFn: ({ signal }) => getOrders(token!, signal),
    enabled: Boolean(token),
  });
  const issue = useMutation({
    mutationFn: ({ orderId, draft }: { orderId: string; draft: ReceiptDraft }) =>
      createRepairReceipt(token!, orderId, draft),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders", token] }),
    onError: () => toast.error("Не удалось сохранить состав чека."),
  });
  const markPaid = useMutation({
    mutationFn: ({
      orderId,
      method,
    }: {
      orderId: string;
      method: NonNullable<RepairReceipt["paymentMethod"]>;
    }) => markReceiptPaid(token!, orderId, method),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders", token] }),
  });
  const bonuses = useMutation({
    mutationFn: ({ orderId, redeem }: { orderId: string; redeem: boolean }) =>
      requestBonusRedemption(token!, orderId, redeem),
    onSuccess: () => client.invalidateQueries({ queryKey: ["orders", token] }),
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Не удалось изменить списание бонусов."),
  });
  return (
    <AppShell active="/checks">
      <PageTitle
        eyebrow="ДОКУМЕНТЫ"
        title="Чеки и сервисные номера"
        description="Сведения о заказах, выполненных работах и сервисных номерах."
      />
      <div className="grid gap-4">
        {(query.data?.orders ?? []).map((order) => {
          const canManageOrder =
            user?.role === "TECHNICIAN" && order.assignedTechnicianId === user.id;
          const isWorkshopOrder =
            order.repairLocation === "SERVICE_CENTER" ||
            (order.visitScenarioVersion === 0 && (order.repairLocation ?? null) === null);
          const canManagePayment = canManageOrder || (user?.role === "ADMIN" && isWorkshopOrder);
          const total = order.items.reduce(
            (sum, item) => sum + item.quantity * item.unitPriceRub,
            0,
          );
          const serviceTotal = order.items
            .filter((item) => item.type === "SERVICE")
            .reduce((sum, item) => sum + item.quantity * item.unitPriceRub, 0);
          const maximumServiceDiscount = Math.floor(serviceTotal * 0.3);
          return (
            <SectionCard
              key={order.id}
              dataPrintTarget={printingOrderId === order.id ? "true" : "false"}
              className="print:break-inside-avoid"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-400">Сервисный номер</p>
                  <h2 className="mt-1 font-semibold">{order.serviceNumber}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {repairDeviceTypeLabel(order.deviceType)} ·{" "}
                    {new Date(order.createdAt).toLocaleDateString("ru-RU")}
                  </p>
                </div>
                {order.receipt && (
                  <button
                    onClick={() => {
                      document.body.classList.add("print-single-receipt");
                      setPrintingOrderId(order.id);
                    }}
                    className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800 print:hidden"
                  >
                    <Printer size={16} />
                    Печать чека
                  </button>
                )}
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800 print:hidden">
                {order.items.length ? (
                  order.items.map((item) => (
                    <div key={item.id} className="flex justify-between gap-4 py-2 text-sm">
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        {(item.unitPriceRub * item.quantity).toLocaleString("ru-RU")} ₽
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="py-2 text-sm text-slate-500">
                    Работы и запчасти пока не добавлены.
                  </p>
                )}
                <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
                  <span>Сумма учтённых работ</span>
                  <span>{total.toLocaleString("ru-RU")} ₽</span>
                </div>
              </div>
              {order.receipt && (
                <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <p className="text-xs text-slate-400">
                    Чек № {order.receipt.receiptNumber} · Сервисный номер{" "}
                    {order.receipt.serviceNumber} ·{" "}
                    {new Date(order.receipt.issuedAt).toLocaleDateString("ru-RU")}
                  </p>
                  <p className="mt-2 text-sm">
                    Клиент: {order.receipt.customerName}
                    {order.receipt.customerPhone ? ` · ${order.receipt.customerPhone}` : ""}
                  </p>
                  {order.receipt.itemsSnapshot.map((item, index) => (
                    <div
                      key={`${item.name}-${index}`}
                      className="mt-2 flex justify-between gap-4 text-sm"
                    >
                      <span>
                        {item.name} × {item.quantity}
                      </span>
                      <span>{item.totalRub.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  ))}
                  <div className="mt-3 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
                    <span>Итого до скидки</span>
                    <span>{order.receipt.totalRub.toLocaleString("ru-RU")} ₽</span>
                  </div>
                  {order.receipt.bonusDiscountRub > 0 && (
                    <div className="mt-2 flex justify-between text-sm text-emerald-700 dark:text-emerald-300">
                      <span>Оплата бонусами</span>
                      <span>−{order.receipt.bonusDiscountRub.toLocaleString("ru-RU")} ₽</span>
                    </div>
                  )}
                  <div className="mt-2 flex justify-between border-t border-slate-100 pt-3 text-sm font-semibold dark:border-slate-800">
                    <span>Итог к оплате</span>
                    <span>
                      {(order.receipt.totalRub - order.receipt.bonusDiscountRub).toLocaleString(
                        "ru-RU",
                      )}{" "}
                      ₽
                    </span>
                  </div>
                  <p className="mt-2 text-sm">
                    Статус: {order.receipt.paymentStatus === "PAID" ? "Оплачено" : "Ожидает оплаты"}
                    {order.receipt.paymentMethod
                      ? ` · ${paymentLabels[order.receipt.paymentMethod]}`
                      : ""}
                  </p>
                  {order.receipt.paidAt && (
                    <p className="mt-1 text-xs text-slate-500">
                      Оплачено {new Date(order.receipt.paidAt).toLocaleString("ru-RU")}
                    </p>
                  )}
                </div>
              )}
              {canManageOrder &&
                order.status === "COMPLETED" &&
                order.receipt?.paymentStatus !== "PAID" && (
                  <ReceiptDraftEditor
                    items={order.items}
                    receiptExists={Boolean(order.receipt)}
                    saving={issue.isPending}
                    onSubmit={(draft) => issue.mutate({ orderId: order.id, draft })}
                  />
                )}
              {canManagePayment && order.status === "COMPLETED" && (
                <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
                  {order.receipt?.paymentStatus === "PENDING" && (
                    <>
                      <button
                        type="button"
                        disabled={
                          bonuses.isPending ||
                          (!order.redeemBonuses && maximumServiceDiscount === 0)
                        }
                        onClick={() =>
                          bonuses.mutate({ orderId: order.id, redeem: !order.redeemBonuses })
                        }
                        className="min-h-9 rounded-lg border border-emerald-300 px-3 text-xs font-semibold text-emerald-800 disabled:opacity-50 dark:border-emerald-800 dark:text-emerald-200"
                      >
                        {order.redeemBonuses
                          ? "Отменить оплату бонусами"
                          : `Списать бонусы за услуги · до ${maximumServiceDiscount.toLocaleString("ru-RU")} ₽`}
                      </button>
                      <select
                        aria-label="Способ оплаты"
                        value={paymentMethods[order.id] ?? "CASH"}
                        onChange={(event) =>
                          setPaymentMethods((current) => ({
                            ...current,
                            [order.id]: event.target.value as NonNullable<
                              RepairReceipt["paymentMethod"]
                            >,
                          }))
                        }
                        className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-xs dark:border-slate-700 dark:bg-slate-900"
                      >
                        {Object.entries(paymentLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <button
                        disabled={markPaid.isPending}
                        onClick={() =>
                          markPaid.mutate({
                            orderId: order.id,
                            method: paymentMethods[order.id] ?? "CASH",
                          })
                        }
                        className="min-h-9 rounded-lg bg-emerald-600 px-3 text-xs font-semibold text-white disabled:opacity-50"
                      >
                        Подтвердить фактическую оплату
                      </button>
                    </>
                  )}
                </div>
              )}
            </SectionCard>
          );
        })}
        {!query.isLoading && (query.data?.orders.length ?? 0) === 0 && (
          <SectionCard>
            <p className="text-sm text-slate-500">Документы появятся после создания заявки.</p>
          </SectionCard>
        )}
      </div>
      <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-slate-400">
        <FileText size={15} className="mt-0.5 shrink-0" />
        Распечатанная карточка содержит учётные сведения о заказе и не является кассовым чеком или
        подтверждением онлайн-оплаты.
      </p>
    </AppShell>
  );
};
export const Route = createFileRoute("/checks")({ component: ChecksPage });
