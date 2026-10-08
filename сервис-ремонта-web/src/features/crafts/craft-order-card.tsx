import { useState } from "react";
import { toast } from "sonner";

import { SectionCard } from "@/components/app-shell";
import { Select } from "@/components/select";

import { CraftOrderChatPanel } from "@/features/crafts/craft-order-chat";
import { ServiceNumberBarcode } from "@/features/orders/service-number-barcode-view";

import {
  type CraftOrder,
  type StaffMember,
  markCraftReceiptPaid,
  updateCraftOrder,
} from "@/lib/api";

const statusLabels: Record<CraftOrder["status"], string> = {
  REQUESTED: "Новая",
  ACCEPTED: "Принята",
  IN_PROGRESS: "В работе",
  COMPLETED: "Завершена",
  CANCELLED: "Отменена",
};

const paymentLabels = {
  CASH: "Наличные",
  CARD_TERMINAL: "Карта",
  BANK_TRANSFER: "Перевод",
  OTHER: "Другое",
};
type CraftPaymentMethod = NonNullable<NonNullable<CraftOrder["receipt"]>["paymentMethod"]>;

export const CraftOrderCard = ({
  order,
  token,
  isAdmin,
  staff,
  onRefresh,
}: {
  order: CraftOrder;
  token: string;
  isAdmin: boolean;
  staff: StaffMember[];
  onRefresh: () => Promise<void>;
}) => {
  const [technicianId, setTechnicianId] = useState(order.assignedTechnicianId ?? "");
  const [unitPrice, setUnitPrice] = useState(
    String(order.quotedPriceRub ?? order.unitPriceRubSnapshot),
  );
  const [paymentMethod, setPaymentMethod] = useState<CraftPaymentMethod>("CASH");
  const priceRub = Number(unitPrice);
  const totalRub = (Number.isInteger(priceRub) ? priceRub : 0) * order.quantity;

  const saveTerms = async (status?: CraftOrder["status"]) => {
    if (!Number.isSafeInteger(priceRub) || priceRub < 0 || priceRub > 10_000_000) {
      toast.error("Укажите целую цену от 0 до 10 000 000 ₽.");
      return;
    }
    try {
      await updateCraftOrder(token, order.id, {
        ...(status ? { status } : {}),
        assignedTechnicianId: technicianId || null,
        quotedPriceRub: unitPrice === "" ? null : priceRub,
      });
      await onRefresh();
      toast.success(
        status === "COMPLETED" ? "Заявка завершена, чек создан." : "Данные заявки сохранены.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось сохранить заявку.");
    }
  };

  const confirmPayment = async () => {
    try {
      await markCraftReceiptPaid(token, order.id, paymentMethod ?? "CASH");
      await onRefresh();
      toast.success("Оплата отмечена. Бонусы начислены по фактически оплаченным деньгам.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Не удалось подтвердить оплату.");
    }
  };

  return (
    <SectionCard>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h3 className="font-semibold">{order.itemTitleSnapshot}</h3>
          <p className="mt-1 text-xs text-slate-500">
            {order.isCustomOrder ? "Индивидуальное изготовление" : "Готовое изделие"} ·{" "}
            {order.quantity} шт. · {new Date(order.createdAt).toLocaleDateString("ru-RU")}
          </p>
          {order.note && (
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{order.note}</p>
          )}
          {isAdmin && order.customer && (
            <p className="mt-2 text-xs text-slate-500">
              {order.customer.displayName} · {order.customer.email} ·{" "}
              {order.customer.phoneNumber || "телефон не указан"}
            </p>
          )}
          {order.assignedTechnician && (
            <p className="mt-2 text-xs text-slate-500">
              Мастер: {order.assignedTechnician.displayName} ·{" "}
              {order.assignedTechnician.salaryRatePercent ?? 75}%
            </p>
          )}
        </div>
        <span className="text-sm font-semibold">{totalRub.toLocaleString("ru-RU")} ₽</span>
      </div>

      {isAdmin && order.status !== "COMPLETED" && order.status !== "CANCELLED" && (
        <div className="mt-4 grid gap-3 rounded-xl border border-slate-200 p-3 sm:grid-cols-2 dark:border-slate-700">
          <label className="grid gap-1 text-xs font-medium">
            Назначенный мастер
            <Select
              ariaLabel="Назначенный мастер"
              value={technicianId}
              placeholder="Выберите мастера"
              onValueChange={setTechnicianId}
              options={[
                { value: "", label: "Без мастера" },
                ...staff
                  .filter((member) => member.role === "TECHNICIAN" && member.active)
                  .map((member) => ({
                    value: member.id,
                    label: `${member.displayName} · ${member.salaryRatePercent}%`,
                  })),
              ]}
              className="h-10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
          <label className="grid gap-1 text-xs font-medium">
            Цена за штуку, ₽
            <input
              aria-label="Цена изделия за штуку"
              type="number"
              min={0}
              max={10000000}
              step={1}
              value={unitPrice}
              onChange={(event) => setUnitPrice(event.target.value)}
              className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-normal dark:border-slate-700 dark:bg-slate-950"
            />
          </label>
          <button
            type="button"
            onClick={() => void saveTerms()}
            className="min-h-9 justify-self-start rounded-lg border border-slate-200 px-3 text-xs font-medium dark:border-slate-700"
          >
            Сохранить мастера и цену
          </button>
          <label className="grid gap-1 text-xs font-medium sm:justify-self-end">
            Статус заявки
            <Select
              ariaLabel="Статус заявки"
              value={order.status}
              onValueChange={(value) => void saveTerms(value as CraftOrder["status"])}
              options={Object.entries(statusLabels).map(([value, label]) => ({ value, label }))}
              className="h-10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
            />
          </label>
        </div>
      )}
      {!isAdmin && (
        <p className="mt-2 text-xs text-slate-500">Статус: {statusLabels[order.status]}</p>
      )}

      {order.receipt && (
        <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm dark:bg-slate-900">
          <h4 className="font-semibold">Чек {order.receipt.receiptNumber}</h4>
          <p className="mt-1 text-xs text-slate-500">
            Сервисный номер: {order.receipt.serviceNumber}
          </p>
          <ServiceNumberBarcode serviceNumber={order.receipt.serviceNumber} />
          <p className="mt-2">Итого: {order.receipt.totalRub.toLocaleString("ru-RU")} ₽</p>
          <p className="mt-1 font-semibold">
            К оплате: {order.receipt.totalRub.toLocaleString("ru-RU")} ₽
          </p>
          <div className="mt-2 grid gap-1 text-xs text-slate-500">
            {order.receipt.itemsSnapshot.map((item, index) => (
              <p key={`${item.name}-${index}`}>
                {item.name} × {item.quantity} · {item.totalRub.toLocaleString("ru-RU")} ₽
              </p>
            ))}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {order.receipt.paymentStatus === "PAID" ? "Оплачен" : "Ожидает оплаты"} · онлайн-оплата
            не подключена
          </p>
          {isAdmin && order.salaryEntry && (
            <p className="mt-1 text-xs text-slate-500">
              Начисление мастеру: {order.salaryEntry.salaryRub.toLocaleString("ru-RU")} ₽ (
              {order.salaryEntry.ratePercent}% от работы)
            </p>
          )}
          {isAdmin && order.receipt.paymentStatus === "PENDING" && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Select
                ariaLabel="Способ оплаты"
                value={paymentMethod ?? "CASH"}
                onValueChange={(value) =>
                  setPaymentMethod(value as NonNullable<typeof paymentMethod>)
                }
                options={Object.entries(paymentLabels).map(([value, label]) => ({ value, label }))}
                className="h-9 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
              />
              <button
                type="button"
                onClick={() => void confirmPayment()}
                className="min-h-9 rounded-lg bg-blue-600 px-3 text-xs font-semibold text-white"
              >
                Подтвердить оплату
              </button>
            </div>
          )}
          {!isAdmin && order.receipt.paymentStatus === "PAID" && (
            <p className="mt-2 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Бонусы за эту заявку начисляются в размере 5% от денежной оплаты.
            </p>
          )}
        </div>
      )}

      <CraftOrderChatPanel
        token={token}
        craftOrderId={order.id}
        isAdmin={isAdmin}
        status={order.status}
      />
    </SectionCard>
  );
};
