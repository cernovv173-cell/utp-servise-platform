import { describe, expect, it, vi } from "vitest";

import { clearCustomerLocalData } from "./account-local-data";

describe("clearCustomerLocalData", () => {
  it("removes only local data belonging to the deleted customer", () => {
    const removeItem = vi.fn();

    clearCustomerLocalData("customer-1", { removeItem });

    expect(removeItem.mock.calls).toEqual([["utp-shop-cart:customer-1"]]);
  });

  it("does not interrupt logout when browser storage is unavailable", () => {
    const removeItem = vi.fn().mockImplementationOnce(() => {
      throw new Error("storage is blocked");
    });

    expect(() => clearCustomerLocalData("customer-1", { removeItem })).not.toThrow();
    expect(removeItem).toHaveBeenCalledTimes(1);
  });
});
