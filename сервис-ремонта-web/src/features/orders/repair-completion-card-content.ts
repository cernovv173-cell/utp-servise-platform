import type { RepairOrder } from "@/lib/api";

const formatWarrantyDays = (days: number) => {
  const lastTwoDigits = days % 100;
  const lastDigit = days % 10;
  const unit =
    lastTwoDigits >= 11 && lastTwoDigits <= 14
      ? "дней"
      : lastDigit === 1
        ? "день"
        : lastDigit >= 2 && lastDigit <= 4
          ? "дня"
          : "дней";

  return `${days} ${unit}`;
};

const formatWarrantyDate = (value: string) => {
  const date = value.slice(0, 10);
  const [year, month, day] = date.split("-");

  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${day}.${month}.${year}` : date;
};

export const buildRepairCompletionCardContent = (
  order: Pick<RepairOrder, "items" | "warranty">,
) => {
  const warranty = order.warranty;
  const serviceSummary = order.items
    .filter((item) => item.type === "SERVICE")
    .map((item) => item.name.trim())
    .filter(Boolean)
    .join(", ");

  return {
    repairSummary:
      warranty?.repairSummary.trim() || serviceSummary || "Работы перечислены в заказ-наряде.",
    warrantyNumber: warranty?.warrantyNumber ?? null,
    warrantyDuration: warranty
      ? `${formatWarrantyDays(warranty.warrantyDays)} · до ${formatWarrantyDate(warranty.expiresAt)}`
      : null,
    warrantyTerms: warranty?.terms.trim() || null,
  };
};
