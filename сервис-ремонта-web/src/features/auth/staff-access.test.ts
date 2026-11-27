import { describe, expect, it } from "vitest";

import type { User } from "@/lib/api";

import { hasPermission, isFullAdministrator } from "./staff-access";

describe("staff access", () => {
  it("keeps a full administrator unrestricted even when permissions are empty", () => {
    const owner: User = {
      id: "owner",
      email: "owner@example.test",
      displayName: "Владелец",
      mustChangePassword: false,
      role: "ADMIN",
      permissions: [],
      isAdminAssistant: false,
    };

    expect(isFullAdministrator(owner)).toBe(true);
    expect(hasPermission(owner, "repairs")).toBe(true);
    expect(hasPermission(owner, "staff_management")).toBe(true);
  });

  it("uses saved permissions for non-admin staff and administrator assistants", () => {
    const employee = { role: "STAFF", permissions: ["repairs"] as const };
    const assistant = {
      role: "ADMIN",
      permissions: ["communications"] as const,
      isAdminAssistant: true,
    };

    expect(hasPermission(employee, "repairs")).toBe(true);
    expect(hasPermission(employee, "inventory")).toBe(false);
    expect(hasPermission(assistant, "communications")).toBe(true);
    expect(hasPermission(assistant, "staff_management")).toBe(false);
  });
});
