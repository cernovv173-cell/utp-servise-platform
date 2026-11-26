import { describe, expect, it } from "vitest";

import { loginPortalOptions } from "./login-role-options";

describe("login portal options", () => {
  it("shows exactly the customer and staff entry choices", () => {
    expect(loginPortalOptions.map((option) => option.value)).toEqual(["CUSTOMER", "STAFF"]);
    expect(loginPortalOptions.map((option) => option.label)).toEqual(["Клиент", "Сотрудник"]);
  });

  it("explains that employee access is resolved from the account after sign-in", () => {
    expect(loginPortalOptions[1]?.description).toBe(
      "Войдите с рабочими данными — система откроет разделы, доступные вашей учётной записи.",
    );
  });
});
