import { describe, expect, it } from "vitest";

import { isStaffLoginRole, staffLoginRoleOptions } from "./login-role-options";

describe("staff login role options", () => {
  it("includes the three staff roles and excludes customer access", () => {
    expect(staffLoginRoleOptions.map((option) => option.value)).toEqual([
      "TECHNICIAN",
      "PROCUREMENT",
      "ADMIN",
    ]);
    expect(isStaffLoginRole("CUSTOMER")).toBe(false);
  });

  it("recognizes every staff role", () => {
    for (const role of ["TECHNICIAN", "PROCUREMENT", "ADMIN"]) {
      expect(isStaffLoginRole(role)).toBe(true);
    }
  });
});
