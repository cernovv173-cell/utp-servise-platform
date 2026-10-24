import { describe, expect, it } from "vitest";

import {
  getNavigationGroupsForRole,
  getPrimaryNavigationLinksForRole,
  isNavigationItemActive,
} from "@/features/navigation/navigation-model";

const routesFor = (role: "CUSTOMER" | "TECHNICIAN" | "ADMIN") =>
  getNavigationGroupsForRole(role).flatMap((group) => group.links.map((link) => link.to));

describe("role-aware section navigation", () => {
  it("keeps customer, technician, and administrator sections within their roles", () => {
    const customerRoutes = routesFor("CUSTOMER");
    const technicianRoutes = routesFor("TECHNICIAN");
    const adminRoutes = routesFor("ADMIN");

    expect(customerRoutes).toContain("/shop");
    expect(customerRoutes).toContain("/support");
    expect(customerRoutes).not.toContain("/game");
    expect(customerRoutes).not.toContain("/salary");
    expect(customerRoutes).not.toContain("/admin/customers");

    expect(technicianRoutes).toContain("/catalog");
    expect(technicianRoutes).toContain("/salary");
    expect(technicianRoutes).not.toContain("/shop");
    expect(technicianRoutes).not.toContain("/admin/orders");

    expect(adminRoutes).toContain("/admin/overview");
    expect(adminRoutes).toContain("/admin/shop-orders");
    expect(adminRoutes).toContain("/advertising");
    expect(adminRoutes).not.toContain("/shop");
  });

  it("keeps the mobile navigation compact without hiding links from the section list", () => {
    for (const role of ["CUSTOMER", "TECHNICIAN", "ADMIN"] as const) {
      const allRoutes = routesFor(role);
      const primary = getPrimaryNavigationLinksForRole(role);

      expect(primary).toHaveLength(4);
      expect(new Set(primary.map((link) => link.to)).size).toBe(primary.length);
      expect(primary.every((link) => allRoutes.includes(link.to))).toBe(true);
    }
  });

  it("marks a nested page active without confusing the home or admin root routes", () => {
    expect(isNavigationItemActive("/admin/schedule", "/admin/schedule")).toBe(true);
    expect(isNavigationItemActive("/admin/orders/123", "/admin/orders")).toBe(true);
    expect(isNavigationItemActive("/admin/orders", "/admin")).toBe(false);
    expect(isNavigationItemActive("/orders", "/")).toBe(false);
  });
});
