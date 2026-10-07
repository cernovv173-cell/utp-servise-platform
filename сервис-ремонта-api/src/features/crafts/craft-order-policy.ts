export const CRAFT_ORDER_BONUS_EARN_PERCENT = 5;

export const calculateCraftOrderTotalRub = (
  unitPriceRub: number,
  quantity: number,
): number => unitPriceRub * quantity;

export const calculateCraftOrderSalaryRub = (
  serviceTotalRub: number,
  ratePercent: number,
): number => Math.round((serviceTotalRub * ratePercent) / 100);

export const calculateCraftOrderEarnedPoints = (cashPaidRub: number): number =>
  Math.floor((Math.max(0, cashPaidRub) * CRAFT_ORDER_BONUS_EARN_PERCENT) / 100);
