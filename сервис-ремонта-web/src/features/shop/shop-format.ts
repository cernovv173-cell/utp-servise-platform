const rubles = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

export const formatShopRub = (amount: number) => `${rubles.format(amount)} ₽`;
