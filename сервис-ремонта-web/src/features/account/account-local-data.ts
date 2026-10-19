const customerLocalDataKeys = (userId: string) => [
  `utp-shop-cart:${userId}`,
  `match3:daily-challenge-completion:v1:${userId}`,
  `match3:raccoon-cosmetic:v1:${userId}`,
  `match3:first-tutorial-seen:v1:${userId}`,
];

export const clearCustomerLocalData = (userId: string, storage?: Pick<Storage, "removeItem">) => {
  let localStorage: Pick<Storage, "removeItem">;
  try {
    localStorage = storage ?? window.localStorage;
  } catch {
    // Account deletion must still complete if this browser blocks local storage access.
    return;
  }

  for (const key of customerLocalDataKeys(userId)) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Continue clearing the other keys even if one removal fails.
    }
  }
};
