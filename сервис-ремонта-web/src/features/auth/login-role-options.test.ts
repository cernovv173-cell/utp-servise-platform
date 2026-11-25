import { describe, expect, it } from "vitest";

import { loginPortalOptions } from "./login-role-options";

describe("login portal options", () => {
  it("shows exactly the customer and administrator entry choices", () => {
    expect(loginPortalOptions.map((option) => option.value)).toEqual(["CUSTOMER", "STAFF"]);
    expect(loginPortalOptions.map((option) => option.label)).toEqual(["Клиент", "Администратор"]);
  });

  it("explains that the staff area is resolved from the account", () => {
    expect(loginPortalOptions[1]?.description).toContain("мастер");
    expect(loginPortalOptions[1]?.description).toContain("закупки");
    expect(loginPortalOptions[1]?.description).toContain("учётной записи");
  });
});
