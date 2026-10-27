import { describe, expect, it } from "vitest";

import {
  getNavigationGroupsForRole,
  getPrimaryNavigationLinksForRole,
  isNavigationItemActive,
} from "@/features/navigation/navigation-model";

import type { Role } from "@/lib/api";

const routesFor = (role: Role) =>
  getNavigationGroupsForRole(role).flatMap((group) => group.links.map((link) => link.to));

const primaryRoutesFor = (role: Role) =>
  getPrimaryNavigationLinksForRole(role).map((link) => link.to);

describe("role-aware primary navigation", () => {
  it("keeps the customer workspace to five consistent sections", () => {
    expect(primaryRoutesFor("CUSTOMER")).toEqual(["/", "/orders", "/shop", "/loyalty", "/account"]);
  });

  it("gives each employee role only its working sections and profile", () => {
    expect(primaryRoutesFor("TECHNICIAN")).toEqual(["/orders", "/catalog", "/salary", "/account"]);
    expect(primaryRoutesFor("ADMIN")).toEqual(["/admin/orders", "/admin", "/catalog", "/account"]);
    expect(primaryRoutesFor("PROCUREMENT")).toEqual(["/admin/procurement", "/catalog", "/account"]);
  });

  it("keeps secondary screens out of the main menu without removing their routes", () => {
    const customerRoutes = routesFor("CUSTOMER");
    const technicianRoutes = routesFor("TECHNICIAN");
    const adminRoutes = routesFor("ADMIN");

    expect(customerRoutes).not.toContain("/offers");
    expect(customerRoutes).not.toContain("/reviews");
    expect(customerRoutes).not.toContain("/support");
    expect(technicianRoutes).not.toContain("/chats");
    expect(adminRoutes).not.toContain("/admin/schedule");
    expect(adminRoutes).not.toContain("/admin/customers");
    expect(customerRoutes).not.toContain("/game");
  });

  it("marks nested routes active without matching root destinations", () => {
    expect(isNavigationItemActive("/admin/orders/123", "/admin/orders")).toBe(true);
    expect(isNavigationItemActive("/admin/schedule", "/admin")).toBe(false);
    expect(isNavigationItemActive("/orders", "/")).toBe(false);
  });
});
