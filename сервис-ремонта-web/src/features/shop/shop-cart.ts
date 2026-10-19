export type ShopCart = Record<string, number>;

export const loadShopCart = (storageKey: string): ShopCart => {
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return {};
    const parsed: unknown = JSON.parse(saved);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([id, quantity]) => id.length > 0 && Number.isInteger(quantity) && Number(quantity) > 0,
      ),
    ) as ShopCart;
  } catch {
    return {};
  }
};

export const setShopCartQuantity = (
  cart: ShopCart,
  productId: string,
  quantity: number,
): ShopCart => {
  if (!Number.isInteger(quantity) || quantity < 1) {
    const next = { ...cart };
    delete next[productId];
    return next;
  }
  return { ...cart, [productId]: Math.min(quantity, 100) };
};

export const getShopCartCount = (cart: ShopCart): number =>
  Object.values(cart).reduce((total, quantity) => total + quantity, 0);
