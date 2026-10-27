import type { CustomerServicePrice } from "@/lib/api";

/**
 * Popular works shown in the guest home price ticker. Only names that exist in the
 * active service price list are used, so the strip never shows an invented amount.
 */
export const featuredHomeServiceNames = [
  "Диагностика ПК",
  "Диагностика ноутбука",
  "Чистка ноутбука от пыли",
  "Замена матрицы ноутбука",
  "Замена блока питания",
  "Установка Windows 11",
  "Замена термопасты в ноутбуке",
  "Сборка ПК под заказ",
  "Клонирование диска",
  "Вызов к заказчику",
] as const;

const minimumFeaturedPrices = 3;

export const pickHomeServicePrices = (
  prices: CustomerServicePrice[],
  limit = 10,
): CustomerServicePrice[] => {
  const byName = new Map(prices.map((price) => [price.name, price]));
  const featured = featuredHomeServiceNames
    .map((name) => byName.get(name))
    .filter((price): price is CustomerServicePrice => Boolean(price));
  const selected = featured.length >= minimumFeaturedPrices ? featured : prices;
  return selected.slice(0, limit);
};
